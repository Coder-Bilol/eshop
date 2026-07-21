const assert = require("node:assert/strict");

const {
  completeCustomerAuth,
  CustomerAuthCompletionError,
  establishCustomerSession,
} = require("../../apps/backend/src/auth/complete-customer-auth.ts");
const {
  BoundedRateLimiter,
  BoundedReplayGuard,
} = require("../../apps/backend/src/auth/rate-limit.ts");
const {
  completionRedirect,
} = require("../../apps/backend/src/api/auth/customer/[provider]/complete/route.ts");

const identity = (id, email, customerId) => ({
  id,
  app_metadata: customerId ? { customer_id: customerId } : {},
  provider_identities: [
    {
      id: `provider-${id}`,
      provider: "google",
      entity_id: `subject-${id}`,
      user_metadata: { email },
    },
  ],
});

const expectCode = (operation, code) =>
  assert.rejects(operation, (error) => {
    assert.equal(error.code, code);
    return true;
  });

async function verifyConcurrentFailureOwnership() {
  const authIdentity = identity("probe-race", "race@example.test");
  const customers = new Map();
  const removed = [];
  let creates = 0;
  let sessionAttempts = 0;
  let startFirstSave;
  let releaseFirstSave;
  const firstSaveStarted = new Promise((resolve) => {
    startFirstSave = resolve;
  });
  const firstSaveReleased = new Promise((resolve) => {
    releaseFirstSave = resolve;
  });
  const dependencies = {
    authService: {
      validateCallback: async () => ({ success: true, authIdentity }),
      retrieveAuthIdentity: async () => authIdentity,
    },
    customerService: {
      listCustomers: async ({ email }) =>
        [...customers.values()].filter((customer) => customer.email === email),
      retrieveCustomer: async (id) => {
        const customer = customers.get(id);
        if (!customer) throw new Error("Customer missing from probe");
        return customer;
      },
    },
    createCustomerAccount: async ({ customerData }) => {
      const customer = {
        id: `probe-race-customer-${++creates}`,
        email: customerData.email,
      };
      customers.set(customer.id, customer);
      authIdentity.app_metadata = { customer_id: customer.id };
      return customer;
    },
    establishSession: async () => {
      sessionAttempts += 1;
      if (sessionAttempts === 1) {
        startFirstSave();
        await firstSaveReleased;
        throw new CustomerAuthCompletionError("auth_session_failed");
      }
    },
    removeCustomerAccount: async (customerId) => {
      removed.push(customerId);
      customers.delete(customerId);
      if (authIdentity.app_metadata.customer_id === customerId) {
        authIdentity.app_metadata = {};
      }
    },
  };

  const failing = completeCustomerAuth(
    "google",
    { actor_type: "customer" },
    dependencies
  );
  await firstSaveStarted;
  const succeeding = completeCustomerAuth(
    "google",
    { actor_type: "customer" },
    dependencies
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sessionAttempts, 1);
  releaseFirstSave();
  await expectCode(() => failing, "auth_session_failed");
  const completion = await succeeding;

  assert.equal(creates, 2);
  assert.deepEqual(removed, ["probe-race-customer-1"]);
  assert.equal(authIdentity.app_metadata.customer_id, completion.customer.id);
  assert.equal(customers.has(completion.customer.id), true);
  return { creates, removed, durableCustomer: completion.customer.id };
}

async function verifyPostCreateReadCompensation() {
  const authIdentity = identity("probe-read", "read@example.test");
  let reads = 0;
  let cleanupCalls = 0;
  let sessionCalls = 0;
  let createdCustomer;

  await expectCode(
    () =>
      completeCustomerAuth(
        "google",
        { actor_type: "customer" },
        {
          authService: {
            validateCallback: async () => ({ success: true, authIdentity }),
            retrieveAuthIdentity: async () => {
              reads += 1;
              if (reads === 3) throw new Error("Injected identity read failure");
              return authIdentity;
            },
          },
          customerService: {
            listCustomers: async () => [],
            retrieveCustomer: async () => {
              throw new Error("Unexpected existing customer read");
            },
          },
          createCustomerAccount: async ({ customerData }) => {
            createdCustomer = {
              id: "probe-read-customer",
              email: customerData.email,
            };
            authIdentity.app_metadata = {
              customer_id: createdCustomer.id,
            };
            return createdCustomer;
          },
          establishSession: async () => {
            sessionCalls += 1;
          },
          removeCustomerAccount: async (customerId) => {
            assert.equal(customerId, createdCustomer.id);
            cleanupCalls += 1;
            createdCustomer = undefined;
            authIdentity.app_metadata = {};
          },
        }
      ),
    "auth_failed"
  );

  assert.equal(reads, 3);
  assert.equal(cleanupCalls, 1);
  assert.equal(sessionCalls, 0);
  assert.equal(createdCustomer, undefined);
  assert.equal(authIdentity.app_metadata.customer_id, undefined);
  return { reads, cleanupCalls, sessionCalls, fullyCompensated: true };
}

async function verifyExistingCustomerPreserved() {
  const authIdentity = identity(
    "probe-existing",
    "existing@example.test",
    "probe-existing-customer"
  );
  let cleanupCalls = 0;

  await expectCode(
    () =>
      completeCustomerAuth(
        "google",
        { actor_type: "customer" },
        {
          authService: {
            validateCallback: async () => ({ success: true, authIdentity }),
            retrieveAuthIdentity: async () => authIdentity,
          },
          customerService: {
            listCustomers: async () => [],
            retrieveCustomer: async () => ({
              id: "probe-existing-customer",
              email: "existing@example.test",
            }),
          },
          createCustomerAccount: async () => {
            throw new Error("Unexpected customer creation");
          },
          establishSession: async () => {
            throw new CustomerAuthCompletionError("auth_session_failed");
          },
          removeCustomerAccount: async () => {
            cleanupCalls += 1;
          },
        }
      ),
    "auth_session_failed"
  );

  assert.equal(cleanupCalls, 0);
  assert.equal(
    authIdentity.app_metadata.customer_id,
    "probe-existing-customer"
  );
  return { cleanupCalls, preserved: true };
}

async function verifyRegressionSurface() {
  const tokenMarker = "probe-provider-token";
  let now = 1_000;
  const limiter = new BoundedRateLimiter({
    limit: 1,
    maxEntries: 1,
    now: () => now,
    salt: "probe-salt",
    windowMs: 100,
  });
  assert.equal(limiter.consume("google\0raw-client-address"), true);
  assert.equal(limiter.consume("google\0raw-client-address"), false);
  assert.equal(limiter.consume("vkid\0other-client-address"), false);
  assert.equal(limiter.snapshot().size, 1);
  assert.match(limiter.snapshot().keys[0], /^[a-f0-9]{64}$/);
  assert.equal(limiter.snapshot().keys[0].includes("raw-client-address"), false);
  now += 101;
  assert.equal(limiter.consume("vkid\0other-client-address"), true);

  const replay = new BoundedReplayGuard(100, {
    maxEntries: 1,
    now: () => now,
    salt: "probe-salt",
  });
  assert.equal(replay.claim("google\0probe-state"), true);
  assert.equal(replay.claim("google\0probe-state"), false);
  assert.match(replay.snapshot().keys[0], /^[a-f0-9]{64}$/);

  const collisionIdentity = identity(
    "probe-collision",
    "collision@example.test"
  );
  let collisionCreates = 0;
  let collisionSessions = 0;
  await expectCode(
    () =>
      completeCustomerAuth(
        "google",
        { actor_type: "customer" },
        {
          authService: {
            validateCallback: async () => ({
              success: true,
              authIdentity: collisionIdentity,
            }),
            retrieveAuthIdentity: async () => collisionIdentity,
          },
          customerService: {
            listCustomers: async () => [
              {
                id: "probe-other-provider-customer",
                email: "collision@example.test",
              },
            ],
            retrieveCustomer: async () => {
              throw new Error("Unexpected collision customer retrieval");
            },
          },
          createCustomerAccount: async () => {
            collisionCreates += 1;
          },
          establishSession: async () => {
            collisionSessions += 1;
          },
          removeCustomerAccount: async () => {},
        }
      ),
    "auth_account_link_required"
  );
  assert.equal(collisionCreates, 0);
  assert.equal(collisionSessions, 0);
  assert.equal(collisionIdentity.app_metadata.customer_id, undefined);

  const sessionOrder = [];
  let savedContext;
  await establishCustomerSession(
    {
      regenerate(callback) {
        sessionOrder.push("regenerate");
        callback();
      },
      save(callback) {
        sessionOrder.push("save");
        savedContext = this.auth_context;
        callback();
      },
      destroy(callback) {
        sessionOrder.push("destroy");
        callback();
      },
    },
    "google",
    {
      ...collisionIdentity,
      provider_identities: [
        {
          ...collisionIdentity.provider_identities[0],
          provider_metadata: { access_token: tokenMarker },
        },
      ],
    },
    { id: "probe-session-customer", email: "session@example.test" }
  );
  assert.deepEqual(sessionOrder, ["regenerate", "save"]);
  assert.equal(JSON.stringify(savedContext).includes(tokenMarker), false);

  const redirect = completionRedirect(
    "https://store.example.test,https://ignored.example.test",
    "google",
    "auth_failed"
  );
  assert.equal(
    redirect,
    "https://store.example.test/auth/complete?provider=google&status=auth_failed"
  );
  assert.equal(redirect.includes("state="), false);
  assert.equal(redirect.includes("code="), false);
  assert.equal(redirect.includes("token"), false);
  assert.equal(
    new CustomerAuthCompletionError("auth_failed").message,
    "Customer authentication could not be completed."
  );

  return {
    rateLimit: "bounded-hashed-fail-closed",
    replay: "single-use-hashed",
    collision: "no-create-no-session-no-link",
    sessionOrder,
    redirect,
    sanitizedError: true,
    browserTokenTransfer: false,
  };
}

async function main() {
  const result = {
    status: "ok",
    concurrentFailureOwnership: await verifyConcurrentFailureOwnership(),
    postCreateReadFailure: await verifyPostCreateReadCompensation(),
    existingCustomerFailure: await verifyExistingCustomerPreserved(),
    regressionSurface: await verifyRegressionSurface(),
  };
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
