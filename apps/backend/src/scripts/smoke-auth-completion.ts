import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

import type {
  AuthIdentityDTO,
  CustomerDTO,
  IAuthModuleService,
  ICustomerModuleService,
} from "@medusajs/framework/types";

import {
  completeCustomerAuth,
  CustomerAuthCompletionError,
  establishCustomerSession,
} from "../auth/complete-customer-auth";
import {
  BoundedRateLimiter,
  BoundedReplayGuard,
} from "../auth/rate-limit";
import { completionRedirect } from "../api/auth/customer/[provider]/complete/route";

const backendRoot = path.resolve(__dirname, "..", "..");
const tokenMarker = "synthetic-provider-token-must-not-survive";

const customer = (id: string, email: string): CustomerDTO =>
  ({ id, email, has_account: true } as CustomerDTO);

const identity = (
  id: string,
  provider: "google" | "vkid",
  email: string,
  customerId?: string
): AuthIdentityDTO => ({
  id,
  app_metadata: customerId ? { customer_id: customerId } : {},
  provider_identities: [
    {
      id: `provider-${id}`,
      provider,
      entity_id: `subject-${id}`,
      provider_metadata: { access_token: tokenMarker },
      user_metadata: {
        email,
        first_name: " Buyer ",
        last_name: " Example ",
      },
    },
  ],
});

const runExistingSuites = (requested: string[], runAll = false) => {
  if (!requested.length && !runAll) {
    return;
  }

  const script = path.resolve(__dirname, "smoke-auth-vkid.ts");
  const result = spawnSync(
    process.execPath,
    ["-r", "ts-node/register", script, ...requested],
    { cwd: backendRoot, env: process.env, stdio: "inherit" }
  );
  if (result.status !== 0) {
    throw new Error("Existing integration suite failed");
  }
};

const expectCode = async (operation: () => Promise<unknown>, code: string) => {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof CustomerAuthCompletionError);
    assert.equal(error.code, code);
    assert.equal(error.message, "Customer authentication could not be completed.");
    return true;
  });
};

async function runAuthCompletionContract() {
  let now = 1_000;
  const limiter = new BoundedRateLimiter({
    limit: 2,
    maxEntries: 2,
    now: () => now,
    salt: "synthetic-test-salt",
    windowMs: 100,
  });
  assert.equal(limiter.consume("google\u0000127.0.0.1"), true);
  assert.equal(limiter.consume("google\u0000127.0.0.1"), true);
  assert.equal(limiter.consume("google\u0000127.0.0.1"), false);
  assert.equal(limiter.consume("vkid\u0000192.0.2.1"), true);
  assert.equal(limiter.consume("vkid\u0000192.0.2.2"), false);
  assert.equal(limiter.snapshot().size, 2);
  assert.ok(
    limiter.snapshot().keys.every(
      (key) => /^[a-f0-9]{64}$/.test(key) && !key.includes("127.0.0.1")
    )
  );
  now += 101;
  assert.equal(limiter.consume("vkid\u0000192.0.2.2"), true);

  const replay = new BoundedReplayGuard(100, {
    maxEntries: 2,
    now: () => now,
    salt: "synthetic-test-salt",
  });
  assert.equal(replay.claim("google\u0000synthetic-state"), true);
  assert.equal(replay.claim("google\u0000synthetic-state"), false);
  assert.ok(
    replay.snapshot().keys.every((key) => /^[a-f0-9]{64}$/.test(key))
  );

  const identities = new Map<string, AuthIdentityDTO>();
  const customers = new Map<string, CustomerDTO>();
  const firstIdentity = identity("auth-google", "google", "Buyer@Example.com");
  identities.set(firstIdentity.id, firstIdentity);
  let activeIdentityId = firstIdentity.id;
  let createCount = 0;
  const customerInputs: unknown[] = [];

  const authService = {
    async validateCallback() {
      return { success: true, authIdentity: identities.get(activeIdentityId)! };
    },
    async retrieveAuthIdentity(id: string) {
      const value = identities.get(id);
      if (!value) {
        throw new Error("Synthetic identity not found");
      }
      return value;
    },
  } as Pick<IAuthModuleService, "retrieveAuthIdentity" | "validateCallback">;
  const customerService = {
    async listCustomers(filters: { email?: string }) {
      return [...customers.values()].filter(
        (value) => value.email === filters.email
      );
    },
    async retrieveCustomer(id: string) {
      const value = customers.get(id);
      if (!value) {
        throw new Error("Synthetic customer not found");
      }
      return value;
    },
  } as Pick<ICustomerModuleService, "listCustomers" | "retrieveCustomer">;
  const createCustomerAccount = async (input: {
    authIdentityId: string;
    customerData: { email: string };
  }) => {
    customerInputs.push(input);
    createCount += 1;
    const created = customer(`cus-${createCount}`, input.customerData.email);
    customers.set(created.id, created);
    const current = identities.get(input.authIdentityId)!;
    identities.set(input.authIdentityId, {
      ...current,
      app_metadata: { customer_id: created.id },
    });
    return created;
  };
  const removeCustomerAccount = async (customerId: string) => {
    customers.delete(customerId);
    for (const [id, current] of identities) {
      if (current.app_metadata?.customer_id === customerId) {
        identities.set(id, { ...current, app_metadata: {} });
      }
    }
  };
  const dependencies = {
    authService,
    customerService,
    createCustomerAccount,
    establishSession: async () => {},
    removeCustomerAccount,
  };

  const first = await completeCustomerAuth(
    "google",
    { actor_type: "customer" },
    dependencies
  );
  assert.equal(first.created, true);
  assert.equal(first.customer.email, "buyer@example.com");
  const repeat = await completeCustomerAuth(
    "google",
    { actor_type: "customer" },
    dependencies
  );
  assert.equal(repeat.created, false);
  assert.equal(repeat.customer.id, first.customer.id);
  assert.equal(createCount, 1);
  assert.equal(JSON.stringify(customerInputs).includes(tokenMarker), false);

  const concurrentIdentity = identity(
    "auth-google-concurrent",
    "google",
    "concurrent@example.com"
  );
  identities.set(concurrentIdentity.id, concurrentIdentity);
  activeIdentityId = concurrentIdentity.id;
  const concurrent = await Promise.all([
    completeCustomerAuth(
      "google",
      { actor_type: "customer" },
      dependencies
    ),
    completeCustomerAuth(
      "google",
      { actor_type: "customer" },
      dependencies
    ),
  ]);
  assert.equal(concurrent[0].customer.id, concurrent[1].customer.id);
  assert.equal(createCount, 2);

  const collisionIdentity = identity(
    "auth-vkid-collision",
    "vkid",
    "buyer@example.com"
  );
  identities.set(collisionIdentity.id, collisionIdentity);
  activeIdentityId = collisionIdentity.id;
  await expectCode(
    () =>
      completeCustomerAuth(
        "vkid",
        { actor_type: "customer" },
        dependencies
      ),
    "auth_account_link_required"
  );
  assert.deepEqual(collisionIdentity.app_metadata, {});
  assert.equal(createCount, 2);

  const missingEmailIdentity = identity("auth-missing", "google", "invalid");
  identities.set(missingEmailIdentity.id, missingEmailIdentity);
  activeIdentityId = missingEmailIdentity.id;
  await expectCode(
    () =>
      completeCustomerAuth(
        "google",
        { actor_type: "customer" },
        dependencies
      ),
    "auth_email_required"
  );
  assert.equal(createCount, 2);

  let savedContext: unknown;
  const session = {
    auth_context: undefined,
    regenerate(callback: (error?: unknown) => void) {
      callback();
    },
    save(callback: (error?: unknown) => void) {
      savedContext = this.auth_context;
      callback();
    },
    destroy(callback: (error?: unknown) => void) {
      callback();
    },
  };
  await establishCustomerSession(
    session,
    "google",
    first.authIdentity,
    first.customer
  );
  assert.deepEqual(savedContext, {
    actor_id: first.customer.id,
    actor_type: "customer",
    auth_identity_id: first.authIdentity.id,
    auth_provider: "google",
    app_metadata: { customer_id: first.customer.id },
    user_metadata: {},
  });
  assert.equal(JSON.stringify(savedContext).includes(tokenMarker), false);

  let existingAccountRollbackCalled = false;
  activeIdentityId = firstIdentity.id;
  await expectCode(
    () =>
      completeCustomerAuth(
        "google",
        { actor_type: "customer" },
        {
          ...dependencies,
          establishSession: (completion) =>
            establishCustomerSession(
              {
                auth_context: undefined,
                regenerate(callback) {
                  callback();
                },
                save(callback) {
                  callback(
                    new Error("synthetic existing-account session failure")
                  );
                },
                destroy(callback) {
                  callback();
                },
              },
              "google",
              completion.authIdentity,
              completion.customer
            ),
          removeCustomerAccount: async () => {
            existingAccountRollbackCalled = true;
          },
        }
      ),
    "auth_session_failed"
  );
  assert.equal(existingAccountRollbackCalled, false);
  assert.equal(customers.has(first.customer.id), true);

  const failedIdentity = identity(
    "auth-google-session-failure",
    "google",
    "session-failure@example.com"
  );
  identities.set(failedIdentity.id, failedIdentity);
  activeIdentityId = failedIdentity.id;
  const failedSession = {
    auth_context: undefined,
    destroyed: false,
    regenerate(callback: (error?: unknown) => void) {
      callback();
    },
    save(callback: (error?: unknown) => void) {
      callback(new Error("synthetic session failure"));
    },
    destroy(callback: (error?: unknown) => void) {
      this.destroyed = true;
      callback();
    },
  };
  let removedCustomerAccounts = 0;
  let failedCustomerId: string | undefined;
  await expectCode(
    () =>
      completeCustomerAuth(
        "google",
        { actor_type: "customer" },
        {
          ...dependencies,
          establishSession: (completion) => {
            failedCustomerId = completion.customer.id;
            return establishCustomerSession(
              failedSession,
              "google",
              completion.authIdentity,
              completion.customer
            );
          },
          removeCustomerAccount: async (customerId) => {
            removedCustomerAccounts += 1;
            await removeCustomerAccount(customerId);
          },
        }
      ),
    "auth_session_failed"
  );
  assert.equal(failedSession.auth_context, undefined);
  assert.equal(failedSession.destroyed, true);
  assert.equal(removedCustomerAccounts, 1);
  assert.ok(failedCustomerId);
  assert.equal(customers.has(failedCustomerId), false);
  assert.equal(
    identities.get(failedIdentity.id)?.app_metadata?.customer_id,
    undefined
  );

  const readFailureIdentity = identity(
    "auth-google-read-failure",
    "google",
    "read-failure@example.com"
  );
  let readFailureReads = 0;
  let readFailureCustomer: CustomerDTO | undefined;
  let readFailureSessionCalls = 0;
  let readFailureCleanupCalls = 0;
  await expectCode(
    () =>
      completeCustomerAuth(
        "google",
        { actor_type: "customer" },
        {
          authService: {
            async validateCallback() {
              return { success: true, authIdentity: readFailureIdentity };
            },
            async retrieveAuthIdentity() {
              readFailureReads += 1;
              if (readFailureReads === 3) {
                throw new Error("synthetic post-create identity read failure");
              }
              return readFailureIdentity;
            },
          },
          customerService: {
            async listCustomers() {
              return [];
            },
            async retrieveCustomer() {
              throw new Error("Synthetic customer must not be retrieved");
            },
          },
          async createCustomerAccount(input) {
            readFailureCustomer = customer(
              "cus-read-failure",
              input.customerData.email
            );
            readFailureIdentity.app_metadata = {
              customer_id: readFailureCustomer.id,
            };
            return readFailureCustomer;
          },
          async establishSession() {
            readFailureSessionCalls += 1;
          },
          async removeCustomerAccount(customerId) {
            readFailureCleanupCalls += 1;
            assert.equal(customerId, readFailureCustomer?.id);
            readFailureIdentity.app_metadata = {};
            readFailureCustomer = undefined;
          },
        }
      ),
    "auth_failed"
  );
  assert.equal(readFailureReads, 3);
  assert.equal(readFailureSessionCalls, 0);
  assert.equal(readFailureCleanupCalls, 1);
  assert.equal(readFailureCustomer, undefined);
  assert.equal(readFailureIdentity.app_metadata?.customer_id, undefined);

  const raceIdentity = identity(
    "auth-google-cleanup-race",
    "google",
    "cleanup-race@example.com"
  );
  const raceCustomers = new Map<string, CustomerDTO>();
  let raceCreates = 0;
  let raceSessionAttempts = 0;
  let signalFirstSave!: () => void;
  let releaseFirstSave!: () => void;
  const firstSaveStarted = new Promise<void>((resolve) => {
    signalFirstSave = resolve;
  });
  const firstSaveReleased = new Promise<void>((resolve) => {
    releaseFirstSave = resolve;
  });
  const raceRemovedCustomers: string[] = [];
  let successfulRaceCustomerId: string | undefined;
  const raceDependencies = {
    authService: {
      async validateCallback() {
        return { success: true, authIdentity: raceIdentity };
      },
      async retrieveAuthIdentity() {
        return raceIdentity;
      },
    },
    customerService: {
      async listCustomers(filters: { email?: string }) {
        return [...raceCustomers.values()].filter(
          (value) => value.email === filters.email
        );
      },
      async retrieveCustomer(id: string) {
        const value = raceCustomers.get(id);
        if (!value) {
          throw new Error("Synthetic race customer not found");
        }
        return value;
      },
    },
    async createCustomerAccount(input: {
      authIdentityId: string;
      customerData: { email: string };
    }) {
      raceCreates += 1;
      const created = customer(
        `cus-cleanup-race-${raceCreates}`,
        input.customerData.email
      );
      raceCustomers.set(created.id, created);
      raceIdentity.app_metadata = { customer_id: created.id };
      return created;
    },
    async establishSession(completion: {
      authIdentity: AuthIdentityDTO;
      customer: CustomerDTO;
    }) {
      raceSessionAttempts += 1;
      const attempt = raceSessionAttempts;
      await establishCustomerSession(
        {
          auth_context: undefined,
          regenerate(callback) {
            callback();
          },
          save(callback) {
            if (attempt === 1) {
              signalFirstSave();
              void firstSaveReleased.then(() =>
                callback(new Error("synthetic concurrent callback failure"))
              );
              return;
            }
            successfulRaceCustomerId = completion.customer.id;
            callback();
          },
          destroy(callback) {
            callback();
          },
        },
        "google",
        completion.authIdentity,
        completion.customer
      );
    },
    async removeCustomerAccount(customerId: string) {
      raceRemovedCustomers.push(customerId);
      raceCustomers.delete(customerId);
      if (raceIdentity.app_metadata?.customer_id === customerId) {
        raceIdentity.app_metadata = {};
      }
    },
  };
  const failingRaceCallback = completeCustomerAuth(
    "google",
    { actor_type: "customer" },
    raceDependencies
  );
  await firstSaveStarted;
  const successfulRaceCallback = completeCustomerAuth(
    "google",
    { actor_type: "customer" },
    raceDependencies
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(raceSessionAttempts, 1);
  releaseFirstSave();
  await expectCode(() => failingRaceCallback, "auth_session_failed");
  const successfulRaceCompletion = await successfulRaceCallback;
  assert.equal(raceCreates, 2);
  assert.equal(raceSessionAttempts, 2);
  assert.deepEqual(raceRemovedCustomers, ["cus-cleanup-race-1"]);
  assert.equal(successfulRaceCustomerId, successfulRaceCompletion.customer.id);
  assert.equal(raceCustomers.has(successfulRaceCompletion.customer.id), true);
  assert.equal(
    raceIdentity.app_metadata?.customer_id,
    successfulRaceCompletion.customer.id
  );

  const redirect = completionRedirect(
    "http://localhost:3000,https://storefront.example.test",
    "vkid",
    "auth_account_link_required"
  );
  assert.equal(
    redirect,
    "http://localhost:3000/auth/complete?provider=vkid&status=auth_account_link_required"
  );
  assert.equal(redirect.includes("code="), false);
  assert.equal(redirect.includes("state="), false);
  assert.equal(redirect.includes("token"), false);

  console.log(
    JSON.stringify({
      command: "test:integration",
      status: "ok",
      suites: ["auth-completion"],
      persistence: "medusa-customer-account-workflow-and-customer-module",
      replay: "single-use-bounded-hashed-state",
      collision: "same-email-cross-provider-rejected",
      redirect: "fixed-sanitized-storefront-completion",
      rateLimit: "bounded-salted-hash-keys",
      session: "server-side-saved-before-redirect",
      cleanupRace: "identity-owned-through-session-and-compensation",
      postCreateReadFailure: "new-customer-and-link-compensated",
      browserTokens: "none",
      credentials: "synthetic-doubles-only",
    })
  );
}

async function main() {
  const requested = process.argv.slice(2);
  if (!requested.length) {
    await runAuthCompletionContract();
    runExistingSuites(["auth-vkid"]);
    runExistingSuites([], true);
    return;
  }

  if (!requested.includes("auth-completion")) {
    runExistingSuites(requested);
    return;
  }

  await runAuthCompletionContract();
  runExistingSuites(requested.filter((name) => name !== "auth-completion"));
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Auth completion integration failed"
  );
  process.exitCode = 1;
});
