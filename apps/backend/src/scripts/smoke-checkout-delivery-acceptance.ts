import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import type {
  ExecArgs,
  IApiKeyModuleService,
  ICustomerModuleService,
} from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  generateJwtToken,
  Modules,
} from "@medusajs/framework/utils";
import {
  batchLinksWorkflow,
  createServiceZonesWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  deleteApiKeysWorkflow,
  deleteStockLocationsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows";

import { DELIVERY_OPTION_IDS } from "../checkout/delivery-options";
import { PAYMENT_IDS } from "../checkout/validation";

const LOCAL_TARIFFS_MINOR_RUB = [0, 50_000, 70_000] as const;
const ACCEPTANCE_PHASE = process.env.CHECKOUT_ACCEPTANCE_PHASE || "run";
const STATE_FILE = process.env.CHECKOUT_ACCEPTANCE_STATE_FILE;
const COMPILED_HEALTH_TIMEOUT_MS = 180_000;
const HEALTH_POLL_INTERVAL_MS = 250;

type RouteResult = { statusCode: number; body: any };
type FixtureState = {
  runId: string;
  phase: "creating" | "ready" | "disabled" | "cleanup_pending";
  resourceLedger: {
    optionIds: string[];
    serviceZoneId?: string;
    fulfillmentSetId?: string;
    stockLocationIds: string[];
  };
  disabledOptionId?: string;
};

export default async function smokeCheckoutDeliveryAcceptance({
  container,
}: ExecArgs) {
  assert.notEqual(
    process.env.NODE_ENV,
    "production",
    "TASK-049 acceptance is local-only and refuses production mode."
  );

  if (ACCEPTANCE_PHASE === "browser-fixtures") {
    return createBrowserFixtures(container);
  }
  if (ACCEPTANCE_PHASE === "browser-disable") {
    return disableBrowserFixture(container);
  }
  if (ACCEPTANCE_PHASE === "browser-cleanup") {
    return cleanupBrowserFixtures(container);
  }

  return runBackendAcceptance(container);
}

async function runBackendAcceptance(container: ExecArgs["container"]) {
  const customerModule = container.resolve<ICustomerModuleService>(
    Modules.CUSTOMER
  );
  const apiKeyModule = container.resolve<IApiKeyModuleService>(Modules.API_KEY);
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL) as any;
  const fulfillment = container.resolve(Modules.FULFILLMENT) as any;
  const [shippingProfile] = await fulfillment.listShippingProfiles({
    type: "default",
  });
  const [provider] = (await fulfillment.listFulfillmentProviders({})).filter(
    (candidate: { id?: unknown; is_enabled?: unknown }) =>
      candidate.id === "manual_manual" && candidate.is_enabled === true
  );

  assert.ok(shippingProfile?.id, "Default local shipping profile is missing.");
  assert.ok(provider?.id, "Enabled manual fulfillment provider is missing.");

  const runId =
    process.env.CHECKOUT_ACCEPTANCE_RUN_ID || `${process.pid}_${Date.now()}`;
  const createdCustomerIds: string[] = [];
  const createdApiKeyIds: string[] = [];
  const fixtureState = createFixtureState(runId);
  let runningServer: { process: ChildProcess; baseUrl: string } | undefined;
  let sessionCookie: string | undefined;

  try {
    await cleanupPreviousSyntheticApiKeys(apiKeyModule, container);

    const customer = await customerModule.createCustomers({
      email: `task049_${runId}@example.test`,
      first_name: "Synthetic",
      last_name: "Acceptance",
      has_account: true,
    });
    createdCustomerIds.push(customer.id);

    await createDeliveryFixtures(
      container,
      fulfillment,
      shippingProfile.id,
      provider.id,
      "TASK-049",
      runId,
      fixtureState,
      () => undefined
    );

    const [salesChannel] = await salesChannelModule.listSalesChannels({
      name: "Default Sales Channel",
    });
    assert.ok(salesChannel?.id, "Default local sales channel is missing.");
    const publishableKey = await apiKeyModule.createApiKeys({
      title: `TASK-049 synthetic publishable key ${runId}`,
      type: "publishable",
      created_by: "task-049-local-acceptance",
    });
    createdApiKeyIds.push(publishableKey.id);
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: { id: publishableKey.id, add: [salesChannel.id] },
    });

    const before = await countCheckoutMutationRecords(container);
    runningServer = await startCompiledMedusa();
    const jwtSecret = resolveJwtSecret(container);
    const bearerToken = generateJwtToken(authContext(customer.id), {
      secret: jwtSecret,
      expiresIn: "5m",
    });
    const commonHeaders = {
      "content-type": "application/json",
      "x-publishable-api-key": publishableKey.token,
    };

    const guest = await requestCheckoutHttp(
      runningServer.baseUrl,
      validInput(),
      { headers: commonHeaders }
    );
    assertError(guest, 401, "checkout_auth_required");

    const authenticated = await requestCheckoutHttp(
      runningServer.baseUrl,
      validInput(),
      {
        headers: {
          ...commonHeaders,
          authorization: `Bearer ${bearerToken}`,
        },
      }
    );
    assert.equal(authenticated.statusCode, 200);
    assert.equal(authenticated.body.snapshot.name, "Synthetic Buyer");
    assert.equal(authenticated.body.snapshot.email, "synthetic.checkout@example.test");
    assert.equal(authenticated.body.snapshot.phone, "+7 900 000 00 00");
    assert.equal(authenticated.body.snapshot.city, "Synthetic City");
    assert.equal(authenticated.body.snapshot.delivery_method, "pickup");
    assert.equal(authenticated.body.snapshot.tariff.amount, 0);
    assert.equal(authenticated.body.snapshot.tariff.currency_code, "RUB");
    assert.equal(authenticated.body.payment_id, "card");
    assert.equal("customer_id" in authenticated.body.snapshot, false);

    sessionCookie = await createMedusaSessionCookie(
      runningServer.baseUrl,
      bearerToken,
      publishableKey.token
    );
    const sessionAuthenticated = await requestCheckoutHttp(
      runningServer.baseUrl,
      validInput(),
      { headers: { ...commonHeaders, cookie: sessionCookie } }
    );
    assert.equal(sessionAuthenticated.statusCode, 200);
    assert.equal("customer_id" in sessionAuthenticated.body.snapshot, false);

    const clientIdentity = await requestCheckoutHttp(
      runningServer.baseUrl,
      validInput({ customer_id: "client-selected" }),
      {
        headers: {
          ...commonHeaders,
          authorization: `Bearer ${bearerToken}`,
        },
      }
    );
    assertError(clientIdentity, 400, "checkout_invalid_request");

    const normalized = await requestCheckoutHttp(
      runningServer.baseUrl,
      validInput({
        name: `  ${"x".repeat(120)}  `,
        email: "  SYNTHETIC.CHECKOUT@EXAMPLE.TEST  ",
        phone: "  +7   900  000  00  00 ",
        city: "  Synthetic   City ",
        address: "  Synthetic   address ",
        comment: "  note   with   spaces ",
        delivery_method: "city_courier",
      }),
      { headers: { ...commonHeaders, authorization: `Bearer ${bearerToken}` } }
    );
    assert.equal(normalized.statusCode, 200);
    assert.equal(normalized.body.snapshot.name, "x".repeat(120));
    assert.equal(normalized.body.snapshot.email, "synthetic.checkout@example.test");
    assert.equal(normalized.body.snapshot.phone, "+7 900 000 00 00");
    assert.equal(normalized.body.snapshot.city, "Synthetic City");
    assert.equal(normalized.body.snapshot.address, "Synthetic address");
    assert.equal(normalized.body.snapshot.comment, "note with spaces");
    assert.equal(normalized.body.snapshot.delivery_method, "city_courier");
    assert.equal(normalized.body.snapshot.tariff.amount, 50_000);
    assert.equal(normalized.body.payment_id, "card");

    for (const field of ["name", "email", "phone", "city"] as const) {
      const body = validInput() as Record<string, unknown>;
      delete body[field];
      const missing = await requestCheckoutHttp(
        runningServer.baseUrl,
        body,
        { headers: { ...commonHeaders, authorization: `Bearer ${bearerToken}` } }
      );
      assertError(missing, 422, "checkout_validation_failed");
      assert.deepEqual(missing.body.error.details, {
        fields: { [field]: "required" },
      });
    }

    const normalizedAtLimit = await requestCheckoutHttp(
      runningServer.baseUrl,
      validInput({ name: ` ${"n".repeat(120)} ` }),
      { headers: { ...commonHeaders, authorization: `Bearer ${bearerToken}` } }
    );
    assert.equal(normalizedAtLimit.statusCode, 200);
    const tooLong = await requestCheckoutHttp(
      runningServer.baseUrl,
      validInput({ name: ` ${"n".repeat(121)} ` }),
      { headers: { ...commonHeaders, authorization: `Bearer ${bearerToken}` } }
    );
    assertError(tooLong, 422, "checkout_validation_failed");
    assert.deepEqual(tooLong.body.error.details, {
      fields: { name: "too_long" },
    });

    const missingAddress = await requestCheckoutHttp(
      runningServer.baseUrl,
      validInput({ delivery_method: "city_courier", address: undefined }),
      { headers: { ...commonHeaders, authorization: `Bearer ${bearerToken}` } }
    );
    assertError(missingAddress, 422, "checkout_validation_failed");
    assert.deepEqual(missingAddress.body.error.details, {
      fields: { address: "required" },
    });

    const pickupWithoutAddress = await requestCheckoutHttp(
      runningServer.baseUrl,
      validInput({ delivery_method: "pickup", address: undefined }),
      { headers: { ...commonHeaders, authorization: `Bearer ${bearerToken}` } }
    );
    assert.equal(pickupWithoutAddress.statusCode, 200);
    assert.equal("address" in pickupWithoutAddress.body.snapshot, false);

    for (const [index, deliveryMethod] of DELIVERY_OPTION_IDS.entries()) {
      const result = await requestCheckoutHttp(
        runningServer.baseUrl,
        validInput({
          delivery_method: deliveryMethod,
          payment_method: PAYMENT_IDS[index],
          ...(deliveryMethod === "pickup"
            ? { address: undefined }
            : { address: "Synthetic address" }),
        }),
        { headers: { ...commonHeaders, authorization: `Bearer ${bearerToken}` } }
      );
      assert.equal(result.statusCode, 200);
      assert.equal(result.body.snapshot.delivery_method, deliveryMethod);
      assert.equal(
        result.body.snapshot.tariff.amount,
        LOCAL_TARIFFS_MINOR_RUB[index]
      );
      assert.equal(result.body.snapshot.tariff.currency_code, "RUB");
      assert.equal(result.body.payment_id, PAYMENT_IDS[index]);
    }

    for (const paymentMethod of PAYMENT_IDS) {
      const result = await requestCheckoutHttp(
        runningServer.baseUrl,
        validInput({ payment_method: paymentMethod }),
        { headers: { ...commonHeaders, authorization: `Bearer ${bearerToken}` } }
      );
      assert.equal(result.statusCode, 200);
      assert.equal(result.body.payment_id, paymentMethod);
    }

    const unsupportedPayment = await requestCheckoutHttp(
      runningServer.baseUrl,
      validInput({ payment_method: "provider-secret-id" }),
      { headers: { ...commonHeaders, authorization: `Bearer ${bearerToken}` } }
    );
    assertError(unsupportedPayment, 422, "checkout_validation_failed");
    assert.deepEqual(unsupportedPayment.body.error.details, {
      fields: { payment_method: "unsupported" },
    });

    const unavailableOptionId = fixtureState.resourceLedger.optionIds[2];
    assert.ok(unavailableOptionId, "Synthetic transport option is missing.");
    await fulfillment.deleteShippingOptions(unavailableOptionId);
    const unavailable = await requestCheckoutHttp(
      runningServer.baseUrl,
      validInput({
        delivery_method: "transport_company",
        address: "Synthetic address",
      }),
      { headers: { ...commonHeaders, authorization: `Bearer ${bearerToken}` } }
    );
    assertError(unavailable, 422, "delivery_method_unavailable");
    assert.deepEqual(unavailable.body.error.details, {
      delivery_method: "transport_company",
    });

    const after = await countCheckoutMutationRecords(container);
    assert.deepEqual(after, before);
    const readOnlyBoundary = assertReadOnlyCheckoutBoundary();

    process.stdout.write(
      `${JSON.stringify(
        {
          suite: "checkout-delivery-acceptance",
          status: "ok",
          sourceBoundary:
            "real-compiled-medusa-http-session-workflow-admin-postgresql",
          authenticatedCheckout: {
            guestStatus: guest.statusCode,
            bearerStatus: authenticated.statusCode,
            sessionStatus: sessionAuthenticated.statusCode,
            clientIdentityRejected: true,
          },
          stableDeliveryIds: [...DELIVERY_OPTION_IDS],
          configuredTariffsRub: LOCAL_TARIFFS_MINOR_RUB.map(
            (amount) => amount / 100
          ),
          paymentIds: [...PAYMENT_IDS],
          normalizationBeforeLimit: true,
          fieldRules: {
            required: ["name", "email", "phone", "city"],
            conditionalAddress: true,
            optionalComment: true,
          },
          sanitizedErrors: true,
          unavailable: {
            status: unavailable.statusCode,
            code: unavailable.body.error.code,
            substituted: false,
          },
          noMutation: { before, after, unchanged: true },
          parser: "standard Medusa parser; malformed JSON normalization deferred",
          productionData: false,
          providerRequest: false,
          providerEvidence: readOnlyBoundary,
          orderMutation: false,
          inventoryMutation: false,
          paymentMutation: false,
          cleanup: "unconditional-finally",
        },
        null,
        2
      )}\n`
    );
  } finally {
    if (sessionCookie && runningServer) {
      await destroyMedusaSession(runningServer.baseUrl, sessionCookie).catch(
        () => undefined
      );
    }
    if (runningServer) {
      await stopCompiledMedusa(runningServer.process);
    }
    await cleanupDeliveryFixtures({
      container,
      customerModule,
      apiKeyModule,
      fulfillment,
      createdCustomerIds,
      createdApiKeyIds,
      fixtureState,
    });
  }
}

async function createBrowserFixtures(container: ExecArgs["container"]) {
  assert.ok(STATE_FILE, "Browser fixture state path is required.");
  const fulfillment = container.resolve(Modules.FULFILLMENT) as any;
  const [shippingProfile] = await fulfillment.listShippingProfiles({
    type: "default",
  });
  const [provider] = (await fulfillment.listFulfillmentProviders({})).filter(
    (candidate: { id?: unknown; is_enabled?: unknown }) =>
      candidate.id === "manual_manual" && candidate.is_enabled === true
  );
  assert.ok(shippingProfile?.id, "Default local shipping profile is missing.");
  assert.ok(provider?.id, "Enabled manual fulfillment provider is missing.");

  const runId =
    process.env.CHECKOUT_ACCEPTANCE_RUN_ID || `${process.pid}_${Date.now()}`;
  const fixtureState = createFixtureState(runId);
  persistFixtureState(fixtureState);
  try {
    await createDeliveryFixtures(
      container,
      fulfillment,
      shippingProfile.id,
      provider.id,
      "TASK-049 browser",
      runId,
      fixtureState,
      () => persistFixtureState(fixtureState)
    );
    fixtureState.phase = "ready";
    persistFixtureState(fixtureState);
    process.stdout.write(
      `${JSON.stringify({
        suite: "checkout-delivery-acceptance",
        phase: "browser-fixtures",
        status: "ok",
        optionCount: fixtureState.resourceLedger.optionIds.length,
        productionData: false,
      })}\n`
    );
  } catch (error) {
    fixtureState.phase = "cleanup_pending";
    persistFixtureState(fixtureState);
    const failures: string[] = [];
    await cleanupBrowserFixtureRecord(
      container,
      fulfillment,
      fixtureState,
      failures
    );
    if (failures.length > 0) {
      throw new AggregateError(
        [error, new Error(`Fixture cleanup failed: ${failures.join(", ")}`)],
        "TASK-049 browser fixture setup and cleanup failed."
      );
    }
    throw error;
  }
}

async function disableBrowserFixture(container: ExecArgs["container"]) {
  const state = readFixtureState();
  const fulfillment = container.resolve(Modules.FULFILLMENT) as any;
  assert.equal(state.resourceLedger.optionIds.length, 3);
  const disabledOptionId = state.resourceLedger.optionIds[2];
  assert.ok(disabledOptionId, "Synthetic transport option is missing.");
  await fulfillment.deleteShippingOptions(disabledOptionId);
  const nextState: FixtureState = {
    ...state,
    phase: "disabled",
    disabledOptionId,
  };
  persistFixtureState(nextState);
  process.stdout.write(
    `${JSON.stringify({
      suite: "checkout-delivery-acceptance",
      phase: "browser-disable",
      status: "ok",
      disabled: true,
      productionData: false,
    })}\n`
  );
}

async function cleanupBrowserFixtures(container: ExecArgs["container"]) {
  const state = readFixtureState();
  const fulfillment = container.resolve(Modules.FULFILLMENT) as any;
  const failures: string[] = [];
  await cleanupBrowserFixtureRecord(container, fulfillment, state, failures);
  if (failures.length > 0) {
    throw new Error("TASK-049 browser fixture cleanup failed.");
  }
  process.stdout.write(
    `${JSON.stringify({
      suite: "checkout-delivery-acceptance",
      phase: "browser-cleanup",
      status: "ok",
      cleanup: "unconditional-finally",
      productionData: false,
    })}\n`
  );
}

async function cleanupBrowserFixtureRecord(
  container: ExecArgs["container"],
  fulfillment: any,
  state: FixtureState,
  failures: string[] = []
) {
  await cleanupFixtureResources(container, fulfillment, state, failures);
}

function readFixtureState(): FixtureState {
  assert.ok(STATE_FILE, "Browser fixture state path is required.");
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as FixtureState;
}

function createFixtureState(runId: string): FixtureState {
  return {
    runId,
    phase: "creating",
    resourceLedger: {
      optionIds: [],
      stockLocationIds: [],
    },
  };
}

function persistFixtureState(state: FixtureState) {
  if (!STATE_FILE) return;
  const temporaryPath = `${STATE_FILE}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, JSON.stringify(state), {
      encoding: "utf8",
      mode: 0o600,
    });
    fs.renameSync(temporaryPath, STATE_FILE);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

function isAlreadyAbsent(error: unknown) {
  return /not found|does not exist|could not find|unknown .*id/i.test(
    error instanceof Error ? error.message : String(error)
  );
}

async function cleanupFixtureResources(
  container: ExecArgs["container"],
  fulfillment: any,
  state: FixtureState,
  failures: string[]
) {
  const attempt = async (label: string, action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      if (!isAlreadyAbsent(error)) {
        failures.push(
          `${label}:${error instanceof Error ? error.name : "unknown"}`
        );
      }
    }
  };

  for (const optionId of state.resourceLedger.optionIds) {
    await attempt(`shipping_option_${optionId}`, () =>
      fulfillment.deleteShippingOptions(optionId)
    );
  }
  if (state.resourceLedger.serviceZoneId) {
    await attempt("service_zone", () =>
      fulfillment.deleteServiceZones(state.resourceLedger.serviceZoneId)
    );
  }
  if (state.resourceLedger.fulfillmentSetId) {
    await attempt("fulfillment_set", () =>
      fulfillment.deleteFulfillmentSets(state.resourceLedger.fulfillmentSetId)
    );
  }
  for (const stockLocationId of state.resourceLedger.stockLocationIds) {
    await attempt(`stock_location_${stockLocationId}`, () =>
      deleteStockLocationsWorkflow(container).run({
        input: { ids: [stockLocationId] },
      })
    );
  }
}

async function cleanupDeliveryFixtures({
  container,
  customerModule,
  apiKeyModule,
  fulfillment,
  createdCustomerIds,
  createdApiKeyIds,
  fixtureState,
}: {
  container: ExecArgs["container"];
  customerModule: ICustomerModuleService;
  apiKeyModule: IApiKeyModuleService;
  fulfillment: any;
  createdCustomerIds: string[];
  createdApiKeyIds: string[];
  fixtureState: FixtureState;
}) {
  const failures: string[] = [];
  const attempt = async (label: string, action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      if (!isAlreadyAbsent(error)) {
        failures.push(
          `${label}:${error instanceof Error ? error.name : "unknown"}`
        );
      }
    }
  };

  if (createdApiKeyIds.length > 0) {
    await attempt("publishable_api_key_revoke", () =>
      Promise.all(
        createdApiKeyIds.map((id) =>
          apiKeyModule.revoke(id, { revoked_by: "task-049-local-acceptance" })
        )
      )
    );
    await attempt("publishable_api_keys", () =>
      deleteApiKeysWorkflow(container).run({ input: { ids: createdApiKeyIds } })
    );
  }
  await cleanupFixtureResources(container, fulfillment, fixtureState, failures);
  for (const [index, customerId] of createdCustomerIds.entries()) {
    await attempt(`customer_${index}`, () =>
      customerModule.deleteCustomers(customerId)
    );
  }

  if (failures.length > 0) {
    process.stderr.write(
      `${JSON.stringify({
        suite: "checkout-delivery-acceptance",
        status: "cleanup_failed",
        failures,
        productionData: false,
      })}\n`
    );
    throw new Error("TASK-049 synthetic fixture cleanup failed.");
  }
}

async function createDeliveryFixtures(
  container: ExecArgs["container"],
  fulfillment: any,
  shippingProfileId: string,
  providerId: string,
  label: string,
  runId: string,
  state: FixtureState,
  persist: () => void
) {
  try {
    const [fulfillmentSet] = await fulfillment.createFulfillmentSets([
      { name: `${label} synthetic fulfillment set ${runId}`, type: "shipping" },
    ]);
    assert.ok(fulfillmentSet?.id, "Synthetic fulfillment set was not created.");
    state.resourceLedger.fulfillmentSetId = fulfillmentSet.id;
    persist();

    const { result: stockLocations } = await createStockLocationsWorkflow(
      container
    ).run({
      input: {
        locations: [{ name: `${label} synthetic stock location ${runId}` }],
      },
    });
    const stockLocationIds = stockLocations
      .map((location) => location?.id)
      .filter((id): id is string => typeof id === "string");
    assert.ok(stockLocationIds.length > 0, "Synthetic stock location was not created.");
    state.resourceLedger.stockLocationIds.push(...stockLocationIds);
    persist();

    await batchLinksWorkflow(container).run({
      input: {
        create: [
          {
            [Modules.STOCK_LOCATION]: { stock_location_id: stockLocationIds[0] },
            [Modules.FULFILLMENT]: { fulfillment_provider_id: providerId },
          },
          {
            [Modules.STOCK_LOCATION]: { stock_location_id: stockLocationIds[0] },
            [Modules.FULFILLMENT]: {
              fulfillment_set_id: fulfillmentSet.id,
            },
          },
        ],
      },
    });

    const { result: serviceZones } = await createServiceZonesWorkflow(
      container
    ).run({
      input: {
        data: [
          {
            name: `${label} synthetic service zone ${runId}`,
            fulfillment_set_id: fulfillmentSet.id,
          },
        ],
      },
    });
    const serviceZoneId = serviceZones[0]?.id;
    assert.ok(serviceZoneId, "Synthetic service zone was not created.");
    state.resourceLedger.serviceZoneId = serviceZoneId;
    persist();

    for (const [index, id] of DELIVERY_OPTION_IDS.entries()) {
      const { result: shippingOptions } =
        await createShippingOptionsWorkflow(container).run({
          input: [
            {
              name: `${label} ${id}`,
              service_zone_id: serviceZoneId as string,
              shipping_profile_id: shippingProfileId,
              provider_id: providerId,
              price_type: "flat" as const,
              type: {
                label: `${label} ${id}`,
                description: "Synthetic local checkout delivery option.",
                code: id,
              },
              prices: [
                { amount: LOCAL_TARIFFS_MINOR_RUB[index], currency_code: "rub" },
              ],
              rules: [
                {
                  attribute: "enabled_in_store",
                  operator: "eq" as const,
                  value: "true",
                },
              ],
              metadata: { task_049_run_id: runId },
            },
          ] as any,
        });
      for (const option of shippingOptions) {
        if (typeof option?.id === "string") {
          state.resourceLedger.optionIds.push(option.id);
          persist();
        }
      }
      assert.equal(shippingOptions.length, 1);
    }

    assert.equal(
      state.resourceLedger.optionIds.length,
      DELIVERY_OPTION_IDS.length
    );
    return state;
  } catch (error) {
    await recordPartialShippingOptions(fulfillment, runId, state, persist).catch(
      () => undefined
    );
    throw error;
  }
}

async function recordPartialShippingOptions(
  fulfillment: any,
  runId: string,
  state: FixtureState,
  persist: () => void
) {
  const options = await fulfillment.listShippingOptions({});
  const knownIds = new Set(state.resourceLedger.optionIds);
  for (const option of options) {
    const metadata = option?.metadata as Record<string, unknown> | undefined;
    if (
      metadata?.task_049_run_id === runId &&
      typeof option?.id === "string" &&
      !knownIds.has(option.id)
    ) {
      state.resourceLedger.optionIds.push(option.id);
      knownIds.add(option.id);
      persist();
    }
  }
}

async function cleanupPreviousSyntheticApiKeys(
  apiKeyModule: IApiKeyModuleService,
  container: ExecArgs["container"]
) {
  const apiKeys = (await apiKeyModule.listApiKeys({
    q: "TASK-049 synthetic publishable key",
  })).filter(
    (apiKey) =>
      apiKey.type === "publishable" &&
      apiKey.title.startsWith("TASK-049 synthetic publishable key ")
  );
  if (apiKeys.length === 0) return;
  for (const apiKey of apiKeys) {
    if (!apiKey.revoked_at) {
      await apiKeyModule.revoke(apiKey.id, {
        revoked_by: "task-049-local-recovery",
      });
    }
  }
  await deleteApiKeysWorkflow(container).run({
    input: { ids: apiKeys.map((apiKey) => apiKey.id) },
  });
}

async function countCheckoutMutationRecords(container: ExecArgs["container"]) {
  const orderModule = container.resolve(Modules.ORDER) as any;
  const paymentModule = container.resolve(Modules.PAYMENT) as any;
  const inventoryModule = container.resolve(Modules.INVENTORY) as any;
  const [, orders] = await orderModule.listAndCountOrders({}, { take: 1 });
  const [, paymentCollections] =
    await paymentModule.listAndCountPaymentCollections({}, { take: 1 });
  const [, reservationItems] =
    await inventoryModule.listAndCountReservationItems({}, { take: 1 });
  return { orders, paymentCollections, reservationItems };
}

function resolveJwtSecret(container: ExecArgs["container"]): string {
  const config = container.resolve(ContainerRegistrationKeys.CONFIG_MODULE) as {
    projectConfig?: { http?: { jwtSecret?: unknown } };
  };
  const secret = config.projectConfig?.http?.jwtSecret;
  assert.equal(typeof secret, "string");
  assert.ok((secret as string).length > 0);
  return secret as string;
}

async function startCompiledMedusa() {
  const port = await reservePort();
  const compiledRoot = path.resolve(process.cwd(), ".medusa", "server");
  const medusaCli = require.resolve("@medusajs/cli/cli");
  const child = spawn(
    process.execPath,
    [medusaCli, "start", "--host", "127.0.0.1", "--port", String(port)],
    {
      cwd: compiledRoot,
      env: {
        ...process.env,
        NODE_ENV: "development",
        PORT: String(port),
        // `medusa start` may load the compiled server as production even when
        // the acceptance harness requests a development runtime. Keep the
        // local file provider deterministic without requiring a developer
        // secret or changing the application config.
        MEDUSA_FILE_URL:
          process.env.MEDUSA_FILE_URL?.trim() ||
          `http://127.0.0.1:${port}/static`,
      },
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    }
  );
  const stderr: string[] = [];
  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk) => stderr.push(String(chunk)));
  try {
    await waitForHttpHealth(child, `http://127.0.0.1:${port}/health`);
    return { process: child, baseUrl: `http://127.0.0.1:${port}` };
  } catch (error) {
    await stopCompiledMedusa(child);
    if (error instanceof Error && stderr.length > 0) {
      error.message += `\nCompiled Medusa stderr:\n${stderr.join("").trim()}`;
    }
    throw error;
  }
}

async function waitForHttpHealth(child: ChildProcess, url: string) {
  let exited = false;
  child.once("exit", () => {
    exited = true;
  });
  const attempts = Math.ceil(
    COMPILED_HEALTH_TIMEOUT_MS / HEALTH_POLL_INTERVAL_MS
  );
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (exited) throw new Error("Compiled Medusa server exited before health check.");
    try {
      const response = await fetch(url);
      if (response.status === 200) return;
    } catch {
      // Local Medusa is still initializing.
    }
    await delay(HEALTH_POLL_INTERVAL_MS);
  }
  throw new Error("Compiled Medusa server did not become ready locally.");
}

async function stopCompiledMedusa(child: ChildProcess) {
  if (child.exitCode !== null || child.killed) return;
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  child.kill("SIGTERM");
  await Promise.race([exited, delay(5_000)]);
  if (child.exitCode === null) child.kill("SIGKILL");
  await Promise.race([exited, delay(2_000)]);
}

async function reservePort() {
  const server = http.createServer();
  await listen(server);
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await closeServer(server);
  return port;
}

async function createMedusaSessionCookie(
  baseUrl: string,
  bearerToken: string,
  publishableKey: string
) {
  const response = await fetch(`${baseUrl}/auth/session`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${bearerToken}`,
      origin: "http://127.0.0.1:3116",
      "x-publishable-api-key": publishableKey,
    },
  });
  assert.equal(response.status, 200);
  const setCookie =
    response.headers.getSetCookie?.()[0] ?? response.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /^connect\.sid=/i);
  return setCookie.split(";", 1)[0];
}

async function destroyMedusaSession(baseUrl: string, cookie: string) {
  const response = await fetch(`${baseUrl}/auth/session`, {
    method: "DELETE",
    headers: { cookie, origin: "http://127.0.0.1:3116" },
  });
  assert.equal(response.status, 200);
}

async function requestCheckoutHttp(
  baseUrl: string,
  body: Record<string, unknown>,
  init: RequestInit = {}
): Promise<RouteResult> {
  const response = await fetch(`${baseUrl}/store/checkout`, {
    ...init,
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Checkout boundary returned non-JSON HTTP ${response.status}.`);
  }
  return { statusCode: response.status, body: parsed };
}

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    name: " Synthetic Buyer ",
    email: " SYNTHETIC.CHECKOUT@EXAMPLE.TEST ",
    phone: "+7 900 000 00 00",
    city: " Synthetic City ",
    address: " Synthetic address ",
    comment: " Synthetic comment ",
    delivery_method: "pickup",
    payment_method: "card",
    ...overrides,
  };
}

function authContext(actorId: string) {
  return {
    actor_id: actorId,
    actor_type: "customer",
    auth_identity_id: "synthetic-auth-identity",
    app_metadata: {},
    user_metadata: {},
  };
}

function assertError(result: RouteResult, statusCode: number, code: string) {
  assert.equal(result.statusCode, statusCode);
  assert.equal(result.body.error.code, code);
  assert.equal(typeof result.body.error.message, "string");
  assert.equal(typeof result.body.error.details, "object");
  assert.doesNotMatch(
    JSON.stringify(result.body),
    /raw|secret|token|provider payload|Synthetic Buyer|example\.test/i
  );
}

function assertReadOnlyCheckoutBoundary() {
  const repositoryRoot = path.resolve(process.cwd(), "..", "..");
  const routeSource = fs.readFileSync(
    path.join(repositoryRoot, "apps/backend/src/api/store/checkout/route.ts"),
    "utf8"
  );
  const workflowSource = fs.readFileSync(
    path.join(
      repositoryRoot,
      "apps/backend/src/workflows/checkout/validate-checkout.ts"
    ),
    "utf8"
  );
  const source = `${routeSource}\n${workflowSource}`;
  assert.doesNotMatch(
    source,
    /Modules\.(ORDER|INVENTORY|PAYMENT)|createOrder|reserveInventory|paymentProvider|providerRequest/i
  );
  assert.match(source, /resolveCheckoutDeliveryOptions/);
  assert.match(source, /payment_id/);
  assert.match(source, /snapshot/);
  return {
    checkoutRouteWorkflowSourceScan: "pass",
    forbiddenOrderInventoryPaymentProviderReferences: false,
  };
}

function listen(server: http.Server) {
  return new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
}

function closeServer(server: http.Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
