import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  createCustomerAccountWorkflow,
  removeCustomerAccountWorkflow,
} from "@medusajs/core-flows";
import type {
  AuthContext,
} from "@medusajs/framework/http";
import type {
  AuthIdentityDTO,
  CustomerDTO,
  ExecArgs,
  IApiKeyModuleService,
  IAuthModuleService,
  ICustomerModuleService,
} from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";

import {
  completeCustomerAuth,
  CustomerAuthCompletionError,
  establishCustomerSession,
  type CustomerAuthProvider,
} from "../auth/complete-customer-auth";

const phase = process.env.AUTH_ACCEPTANCE_PHASE ?? "full";
const runId = process.env.AUTH_ACCEPTANCE_RUN_ID ?? `task033${Date.now()}`;
const stateFile = process.env.AUTH_ACCEPTANCE_STATE_FILE;

if (!/^[a-z0-9]{8,40}$/.test(runId)) {
  throw new Error("AUTH_ACCEPTANCE_RUN_ID must be a bounded lowercase identifier.");
}

type Fixture = {
  authIdentityId: string;
  email: string;
  entityId: string;
  provider: CustomerAuthProvider;
};

const fixtures = {
  google: fixture("google"),
  vkid: fixture("vkid"),
  collision: fixture("collision", "vkid"),
  missingEmail: fixture("missing", "google"),
};

export default async function smokeAuthAcceptance({ container }: ExecArgs) {
  if (!new Set(["write", "read", "cleanup", "full"]).has(phase)) {
    throw new Error(`Unsupported auth acceptance phase: ${phase}`);
  }

  const authModule = container.resolve<IAuthModuleService>(Modules.AUTH);
  const apiKeyModule =
    container.resolve<IApiKeyModuleService>(Modules.API_KEY);
  const customerModule =
    container.resolve<ICustomerModuleService>(Modules.CUSTOMER);
  assertRuntimeConfiguration(container);

  if (phase === "cleanup") {
    await cleanupFixtures(
      container,
      apiKeyModule,
      authModule,
      customerModule
    );
    writeResult("cleanup", {
      fixturesRemoved: true,
    });
    return;
  }

  if (phase === "write" || phase === "full") {
    await cleanupFixtures(
      container,
      apiKeyModule,
      authModule,
      customerModule
    );
    const runtimeState = await writeFixtures(
      container,
      authModule,
      customerModule
    );
    const publishableKey = await apiKeyModule.createApiKeys({
      title: apiKeyTitle(),
      type: "publishable",
      created_by: "task033-local-acceptance",
    });
    writeRuntimeState({
      ...runtimeState,
      publishableApiKey: publishableKey.token,
    });
    writeResult("write", {
      providersCompleted: 2,
      repeatLoginReusedCustomer: true,
      collisionAtomic: true,
      missingEmailAtomic: true,
      sessionSavedServerSide: true,
      cookieAndCorsPolicy: true,
    });
  }

  if (phase === "read" || phase === "full") {
    await readFixtures(authModule, customerModule);
    writeResult("read", {
      freshProcess: phase === "read",
      durableProviderIdentities: 2,
      durableCustomerLinks: 2,
      sessionStatePersisted: false,
      providerTokensPersisted: false,
    });
  }
}

function assertRuntimeConfiguration(container: ExecArgs["container"]) {
  const config = container.resolve<{
    projectConfig: {
      cookieOptions: Record<string, unknown>;
      http: {
        authCors: string;
        storeCors: string;
      };
      sessionOptions: Record<string, unknown>;
    };
  }>(ContainerRegistrationKeys.CONFIG_MODULE);
  const { cookieOptions, http, sessionOptions } = config.projectConfig;

  assert.equal(cookieOptions.httpOnly, true);
  assert.equal(cookieOptions.sameSite, "lax");
  assert.equal(cookieOptions.path, "/");
  assert.equal(Number(cookieOptions.maxAge) > 0, true);
  assert.equal(sessionOptions.resave, false);
  assert.equal(sessionOptions.saveUninitialized, false);
  assert.equal(Number(sessionOptions.ttl) > 0, true);
  for (const cors of [http.authCors, http.storeCors]) {
    assert.equal(cors.includes("*"), false);
    for (const origin of cors.split(",")) {
      assert.equal(new URL(origin.trim()).origin, origin.trim());
    }
  }
}

async function writeFixtures(
  container: ExecArgs["container"],
  authModule: IAuthModuleService,
  customerModule: ICustomerModuleService
) {
  const completions = new Map<CustomerAuthProvider, CustomerDTO>();

  for (const fixtureValue of [fixtures.google, fixtures.vkid]) {
    await createFixtureIdentity(authModule, fixtureValue, fixtureValue.email);
    const firstSession = createSessionRecorder();
    const first = await completeFixture(
      container,
      authModule,
      customerModule,
      fixtureValue,
      firstSession
    );
    assert.equal(first.created, true);
    assert.equal(first.customer.email, fixtureValue.email);
    assert.equal(firstSession.saved, true);
    assert.equal(firstSession.destroyed, false);
    assert.equal(firstSession.auth_context?.actor_id, first.customer.id);
    assert.equal(firstSession.auth_context?.actor_type, "customer");

    const repeatSession = createSessionRecorder();
    const repeat = await completeFixture(
      container,
      authModule,
      customerModule,
      fixtureValue,
      repeatSession
    );
    assert.equal(repeat.created, false);
    assert.equal(repeat.customer.id, first.customer.id);
    assert.equal(repeatSession.saved, true);
    await destroySession(repeatSession);
    assert.equal(repeatSession.destroyed, true);
    assert.equal(repeatSession.auth_context, undefined);

    const matchingCustomers = await customerModule.listCustomers({
      email: fixtureValue.email,
    });
    assert.equal(matchingCustomers.length, 1);
    completions.set(fixtureValue.provider, first.customer);
  }

  await createFixtureIdentity(
    authModule,
    fixtures.collision,
    fixtures.google.email
  );
  const collisionSession = createSessionRecorder();
  await expectCompletionCode(
    () =>
      completeFixture(
        container,
        authModule,
        customerModule,
        fixtures.collision,
        collisionSession
      ),
    "auth_account_link_required"
  );
  assert.equal(collisionSession.saved, false);
  assert.equal(
    linkedCustomerId(
      await authModule.retrieveAuthIdentity(fixtures.collision.authIdentityId)
    ),
    null
  );

  await createFixtureIdentity(authModule, fixtures.missingEmail, undefined);
  const missingEmailSession = createSessionRecorder();
  await expectCompletionCode(
    () =>
      completeFixture(
        container,
        authModule,
        customerModule,
        fixtures.missingEmail,
        missingEmailSession
      ),
    "auth_email_required"
  );
  assert.equal(missingEmailSession.saved, false);
  assert.equal(
    linkedCustomerId(
      await authModule.retrieveAuthIdentity(fixtures.missingEmail.authIdentityId)
    ),
    null
  );

  assert.equal(completions.size, 2);
  const googleCustomer = completions.get("google");
  assert.ok(googleCustomer);
  return {
    authIdentityId: fixtures.google.authIdentityId,
    customerId: googleCustomer.id,
    provider: fixtures.google.provider,
  };
}

async function readFixtures(
  authModule: IAuthModuleService,
  customerModule: ICustomerModuleService
) {
  for (const fixtureValue of [fixtures.google, fixtures.vkid]) {
    const identity = await authModule.retrieveAuthIdentity(
      fixtureValue.authIdentityId,
      { relations: ["provider_identities"] }
    );
    const customerId = linkedCustomerId(identity);
    assert.ok(customerId);

    const customer = await customerModule.retrieveCustomer(customerId);
    assert.equal(customer.email, fixtureValue.email);
    assert.equal(customer.has_account, true);

    const providerIdentities = await authModule.listProviderIdentities({
      auth_identity_id: fixtureValue.authIdentityId,
      entity_id: fixtureValue.entityId,
      provider: fixtureValue.provider,
    });
    assert.equal(providerIdentities.length, 1);
    assert.equal(providerIdentities[0].auth_identity_id, identity.id);

    const persisted = JSON.stringify({ identity, customer });
    assert.equal(/access_token|refresh_token|id_token/i.test(persisted), false);
    assert.equal(/session(?:_id)?/i.test(persisted), false);
  }

  for (const fixtureValue of [fixtures.collision, fixtures.missingEmail]) {
    const identity = await authModule.retrieveAuthIdentity(
      fixtureValue.authIdentityId,
      { relations: ["provider_identities"] }
    );
    assert.equal(linkedCustomerId(identity), null);
  }
}

async function createFixtureIdentity(
  authModule: IAuthModuleService,
  fixtureValue: Fixture,
  email: string | undefined
) {
  return authModule.createAuthIdentities({
    id: fixtureValue.authIdentityId,
    app_metadata: {},
    provider_identities: [
      {
        id: `provid_${runId}_${fixtureValue.provider}_${fixtureValue.entityId.slice(-8)}`,
        provider: fixtureValue.provider,
        entity_id: fixtureValue.entityId,
        provider_metadata: { fixture: "task033" },
        user_metadata: {
          ...(email ? { email } : {}),
          first_name: "Synthetic",
          last_name: "Buyer",
        },
      },
    ],
  });
}

async function completeFixture(
  container: ExecArgs["container"],
  authModule: IAuthModuleService,
  customerModule: ICustomerModuleService,
  fixtureValue: Fixture,
  session: ReturnType<typeof createSessionRecorder>
) {
  const authService = {
    async validateCallback() {
      return {
        success: true,
        authIdentity: await authModule.retrieveAuthIdentity(
          fixtureValue.authIdentityId,
          { relations: ["provider_identities"] }
        ),
      };
    },
    retrieveAuthIdentity: authModule.retrieveAuthIdentity.bind(authModule),
  } as Pick<IAuthModuleService, "retrieveAuthIdentity" | "validateCallback">;

  return completeCustomerAuth(
    fixtureValue.provider,
    { actor_type: "customer" },
    {
      authService,
      customerService: customerModule,
      createCustomerAccount: async (input) => {
        const { result } = await createCustomerAccountWorkflow(container).run({
          input,
        });
        return result;
      },
      establishSession: (completion) =>
        establishCustomerSession(
          session,
          fixtureValue.provider,
          completion.authIdentity,
          completion.customer
        ),
      removeCustomerAccount: async (customerId) => {
        await removeCustomerAccountWorkflow(container).run({
          input: { customerId },
        });
      },
    }
  );
}

async function cleanupFixtures(
  container: ExecArgs["container"],
  apiKeyModule: IApiKeyModuleService,
  authModule: IAuthModuleService,
  customerModule: ICustomerModuleService
) {
  const allFixtures = Object.values(fixtures);
  const apiKeys = await apiKeyModule.listApiKeys({ title: apiKeyTitle() });
  if (apiKeys.length) {
    for (const apiKey of apiKeys) {
      if (!apiKey.revoked_at) {
        await apiKeyModule.revoke(apiKey.id, {
          revoked_by: "task033-local-acceptance",
        });
      }
    }
    await apiKeyModule.deleteApiKeys(apiKeys.map((apiKey) => apiKey.id));
  }

  for (const fixtureValue of allFixtures) {
    try {
      const identity = await authModule.retrieveAuthIdentity(
        fixtureValue.authIdentityId
      );
      const customerId = linkedCustomerId(identity);
      if (customerId) {
        await removeCustomerAccountWorkflow(container).run({
          input: { customerId },
        });
      }
    } catch {
      // Cleanup continues so a partial prior run cannot block the next fixture.
    }
  }

  const emails = new Set(allFixtures.map((fixtureValue) => fixtureValue.email));
  for (const email of emails) {
    const customers = await customerModule.listCustomers({ email });
    if (customers.length) {
      await customerModule.deleteCustomers(customers.map((customer) => customer.id));
    }
  }

  const identities = await authModule.listAuthIdentities({
    id: allFixtures.map((fixtureValue) => fixtureValue.authIdentityId),
  });
  if (identities.length) {
    await authModule.deleteAuthIdentities(
      identities.map((identity) => identity.id)
    );
  }

  const remainingIdentities = await authModule.listAuthIdentities({
    id: allFixtures.map((fixtureValue) => fixtureValue.authIdentityId),
  });
  assert.equal(remainingIdentities.length, 0);
  for (const email of emails) {
    assert.equal((await customerModule.listCustomers({ email })).length, 0);
  }
  assert.equal(
    (await apiKeyModule.listApiKeys({ title: apiKeyTitle() })).length,
    0
  );
}

function fixture(
  label: string,
  provider: CustomerAuthProvider = label as CustomerAuthProvider
): Fixture {
  return {
    authIdentityId: `authusr_${runId}_${label}`,
    email: `${runId}.${label}@example.test`,
    entityId: `subject_${runId}_${label}`,
    provider,
  };
}

function linkedCustomerId(identity: AuthIdentityDTO) {
  const value = identity.app_metadata?.customer_id;
  return typeof value === "string" && value ? value : null;
}

function apiKeyTitle() {
  return `TASK-033 local acceptance ${runId}`;
}

function createSessionRecorder() {
  return {
    auth_context: undefined as AuthContext | undefined,
    saved: false,
    destroyed: false,
    regenerate(callback: (error?: unknown) => void) {
      callback();
    },
    save(callback: (error?: unknown) => void) {
      this.saved = true;
      callback();
    },
    destroy(callback: (error?: unknown) => void) {
      this.destroyed = true;
      delete this.auth_context;
      callback();
    },
  };
}

function destroySession(session: ReturnType<typeof createSessionRecorder>) {
  return new Promise<void>((resolve, reject) => {
    session.destroy((error) => (error ? reject(error) : resolve()));
  });
}

async function expectCompletionCode(
  operation: () => Promise<unknown>,
  code: string
) {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof CustomerAuthCompletionError);
    assert.equal(error.code, code);
    return true;
  });
}

function writeResult(
  currentPhase: string,
  assertions: Record<string, unknown>
) {
  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "auth-acceptance",
        phase: currentPhase,
        status: "ok",
        sourceBoundary: "medusa-auth-customer-postgresql",
        evidencePrivacy: "coarse-assertions-only",
        ...assertions,
      },
      null,
      2
    )}\n`
  );
}

function writeRuntimeState(state: {
  authIdentityId: string;
  customerId: string;
  provider: CustomerAuthProvider;
  publishableApiKey: string;
}) {
  if (!stateFile || !path.isAbsolute(stateFile)) {
    throw new Error("AUTH_ACCEPTANCE_STATE_FILE must be an absolute local path.");
  }
  fs.writeFileSync(stateFile, JSON.stringify(state), {
    encoding: "utf8",
    mode: 0o600,
  });
}
