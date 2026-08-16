import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import express from "express";

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

import checkoutMiddlewares from "../api/middlewares";
import { POST } from "../api/store/checkout/route";
import { DELIVERY_OPTION_IDS } from "../checkout/delivery-options";
import { PAYMENT_IDS } from "../checkout/validation";

const LOCAL_TARIFFS_MINOR_RUB = [0, 50_000, 70_000] as const;

type RouteResult = { statusCode: number; body: any };

export default async function smokeCheckoutDelivery({
  container,
}: ExecArgs) {
  assert.notEqual(
    process.env.NODE_ENV,
    "production",
    "TASK-047 smoke is local-only and refuses production mode."
  );

  assertCheckoutMiddleware();

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

  const runId = `${process.pid}_${Date.now()}`;
  const createdCustomerIds: string[] = [];
  const createdOptionIds: string[] = [];
  const createdApiKeyIds: string[] = [];
  let serviceZoneId: string | undefined;
  let fulfillmentSetId: string | undefined;
  let stockLocationId: string | undefined;

  try {
    await cleanupPreviousSyntheticApiKeys(container, apiKeyModule);

    const customer = await customerModule.createCustomers({
      email: `task047_${runId}@example.test`,
      first_name: "Synthetic",
      last_name: "Checkout",
      has_account: true,
    });
    createdCustomerIds.push(customer.id);

    const [fulfillmentSet] = await fulfillment.createFulfillmentSets([
      {
        name: `TASK-047 synthetic fulfillment set ${runId}`,
        type: "shipping",
      },
    ]);
    fulfillmentSetId = fulfillmentSet.id;

    const { result: stockLocations } = await createStockLocationsWorkflow(
      container
    ).run({
      input: {
        locations: [{ name: `TASK-047 synthetic stock location ${runId}` }],
      },
    });
    stockLocationId = stockLocations[0]?.id;
    assert.ok(stockLocationId, "Synthetic stock location was not created.");

    await batchLinksWorkflow(container).run({
      input: {
        create: [
          {
            [Modules.STOCK_LOCATION]: { stock_location_id: stockLocationId },
            [Modules.FULFILLMENT]: {
              fulfillment_provider_id: provider.id,
            },
          },
          {
            [Modules.STOCK_LOCATION]: { stock_location_id: stockLocationId },
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
            name: `TASK-047 synthetic service zone ${runId}`,
            fulfillment_set_id: fulfillmentSet.id,
          },
        ],
      },
    });
    serviceZoneId = serviceZones[0]?.id;
    assert.ok(serviceZoneId, "Synthetic service zone was not created.");

    const { result: shippingOptions } = await createShippingOptionsWorkflow(
      container
    ).run({
      input: DELIVERY_OPTION_IDS.map((id, index) => ({
        name: `TASK-047 ${id}`,
        service_zone_id: serviceZoneId as string,
        shipping_profile_id: shippingProfile.id,
        provider_id: provider.id,
        price_type: "flat" as const,
        type: {
          label: `TASK-047 ${id}`,
          description: "Synthetic local checkout delivery option.",
          code: id,
        },
        prices: [
          {
            amount: LOCAL_TARIFFS_MINOR_RUB[index],
            currency_code: "rub",
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            operator: "eq" as const,
            value: "true",
          },
        ],
        metadata: { task_047_run_id: runId },
      })),
    });
    createdOptionIds.push(...shippingOptions.map((option) => option.id));
    assert.equal(createdOptionIds.length, DELIVERY_OPTION_IDS.length);

    const [salesChannel] = await salesChannelModule.listSalesChannels({
      name: "Default Sales Channel",
    });
    assert.ok(salesChannel?.id, "Default local sales channel is missing.");

    const publishableKey = await apiKeyModule.createApiKeys({
      title: `TASK-047 synthetic publishable key ${runId}`,
      type: "publishable",
      created_by: "task-047-local-smoke",
    });
    createdApiKeyIds.push(publishableKey.id);
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: { id: publishableKey.id, add: [salesChannel.id] },
    });

    const httpBoundary = await assertHttpCheckoutBoundary(
      container,
      customer.id,
      publishableKey.token
    );

    const actorContext = authContext(customer.id);
    const requestTrace = createReadOnlyScope(container);
    const assertions = {
      middlewareRegistered: true,
      unauthenticatedDenied: false,
      clientIdentityRejected: false,
      normalizedAndBounded: false,
      pickupAddressOptional: false,
      conditionalAddressEnforced: false,
      stableDeliveryAndTariffHandoff: false,
      stablePaymentIds: false,
      unavailableMethodStable: false,
      sanitizedErrors: false,
      noMutationCalls: false,
    };

    assertions.unauthenticatedDenied = httpBoundary.unauthenticatedDenied;

    const clientIdentity = await callCheckout(
      requestTrace.scope,
      actorContext,
      validInput({ customer_id: "client-selected" })
    );
    assertError(clientIdentity, 400, "checkout_invalid_request");
    assertions.clientIdentityRejected = true;

    const normalized = await callCheckout(
      requestTrace.scope,
      actorContext,
      validInput({
        name: `  ${"x".repeat(120)}  `,
        address: "   ",
        comment: "  note   with   spaces ",
      })
    );
    assert.equal(normalized.statusCode, 200);
    assert.equal(normalized.body.snapshot.name, "x".repeat(120));
    assert.equal(normalized.body.snapshot.comment, "note with spaces");
    assert.equal("address" in normalized.body.snapshot, false);
    assert.equal("customer_id" in normalized.body.snapshot, false);
    assertions.normalizedAndBounded = true;

    const tooLong = await callCheckout(
      requestTrace.scope,
      actorContext,
      validInput({ name: `  ${"x".repeat(121)}  ` })
    );
    assertError(tooLong, 422, "checkout_validation_failed");
    assert.deepEqual(tooLong.body.error.details, {
      fields: { name: "too_long" },
    });

    const missingAddress = await callCheckout(
      requestTrace.scope,
      actorContext,
      validInput({ delivery_method: "city_courier", address: undefined })
    );
    assertError(missingAddress, 422, "checkout_validation_failed");
    assert.deepEqual(missingAddress.body.error.details, {
      fields: { address: "required" },
    });
    assertions.conditionalAddressEnforced = true;

    const pickup = await callCheckout(
      requestTrace.scope,
      actorContext,
      validInput({ delivery_method: "pickup", address: undefined })
    );
    assert.equal(pickup.statusCode, 200);
    assert.equal(pickup.body.snapshot.delivery_method, "pickup");
    assert.equal(pickup.body.snapshot.tariff.amount, 0);
    assert.equal(pickup.body.snapshot.tariff.currency_code, "RUB");
    assertions.pickupAddressOptional = true;

    const stableMethods = [];
    for (const [index, deliveryMethod] of DELIVERY_OPTION_IDS.entries()) {
      const result = await callCheckout(
        requestTrace.scope,
        actorContext,
        validInput({
          delivery_method: deliveryMethod,
          payment_method: PAYMENT_IDS[index],
          ...(deliveryMethod === "pickup" ? {} : { address: "Synthetic address" }),
        })
      );
      assert.equal(result.statusCode, 200);
      assert.equal(result.body.snapshot.delivery_method, deliveryMethod);
      assert.equal(result.body.snapshot.tariff.amount, LOCAL_TARIFFS_MINOR_RUB[index]);
      assert.equal(result.body.payment_id, PAYMENT_IDS[index]);
      stableMethods.push(deliveryMethod);
    }
    assert.deepEqual(stableMethods, [...DELIVERY_OPTION_IDS]);
    assertions.stableDeliveryAndTariffHandoff = true;
    assertions.stablePaymentIds = true;

    const unsupportedPayment = await callCheckout(
      requestTrace.scope,
      actorContext,
      validInput({ payment_method: "provider-secret-id" })
    );
    assertError(unsupportedPayment, 422, "checkout_validation_failed");
    assert.deepEqual(unsupportedPayment.body.error.details, {
      fields: { payment_method: "unsupported" },
    });
    assertions.sanitizedErrors = true;

    await fulfillment.deleteShippingOptions(createdOptionIds[2]);
    const unavailable = await callCheckout(
      requestTrace.scope,
      actorContext,
      validInput({
        delivery_method: "transport_company",
        address: "Synthetic address",
      })
    );
    assertError(unavailable, 422, "delivery_method_unavailable");
    assert.deepEqual(unavailable.body.error.details, {
      delivery_method: "transport_company",
    });
    assertions.unavailableMethodStable = true;

    assert.deepEqual(requestTrace.mutations, []);
    assert.deepEqual(requestTrace.forbiddenResolves, []);
    assertReadOnlyCheckoutBoundary();
    assertions.noMutationCalls = true;

    process.stdout.write(
      `${JSON.stringify(
        {
          suite: "checkout-delivery",
          status: "ok",
          sourceBoundary: "medusa-http-route-middleware-session-workflow-admin-shipping-options",
          assertions,
          stableDeliveryIds: [...DELIVERY_OPTION_IDS],
          paymentIds: [...PAYMENT_IDS],
          configuredTariffsRub: LOCAL_TARIFFS_MINOR_RUB.map((amount) => amount / 100),
           unauthenticatedHttp: httpBoundary.unauthenticated,
           authenticatedHttp: httpBoundary.authenticated,
           realMedusaHttp: {
             guest: httpBoundary.realMedusaGuest,
             authenticatedBearer: httpBoundary.realMedusaAuthenticated,
             authenticatedSession: httpBoundary.realMedusaSessionAuthenticated,
             ownership: httpBoundary.realMedusaOwnership,
             runtime: httpBoundary.realMedusaRuntime,
           },
          unavailable: {
            code: unavailable.body.error.code,
            status: unavailable.statusCode,
            substituted: false,
          },
          operationBoundary:
            "Admin Shipping Options and linked price-set reads only; checkout route/workflow has no order, inventory, payment, or provider mutation boundary",
          productionData: false,
          providerRequest: false,
          orderMutation: false,
          inventoryMutation: false,
          paymentMutation: false,
        },
        null,
        2
      )}\n`
    );
  } finally {
    await cleanupCheckoutFixtures({
      container,
      customerModule,
      fulfillment,
      createdCustomerIds,
      createdOptionIds,
      createdApiKeyIds,
      apiKeyModule,
      serviceZoneId,
      fulfillmentSetId,
      stockLocationId,
    });
  }
}

async function assertHttpCheckoutBoundary(
  container: ExecArgs["container"],
  customerId: string,
  publishableKey: string
) {
  const app = express();
  let session: Record<string, unknown> = {};
  const middlewareRoute = findCheckoutMiddlewareRoute();

  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).scope = container;
    (req as any).session = session;
    next();
  });
  app.post(
    "/store/checkout",
    ...(middlewareRoute.middlewares ?? []).map((middleware) =>
      middleware as any
    ),
    (req, res) => {
      void POST(req as any, res as any);
    }
  );

  const server = http.createServer(app);
  await listen(server);
  let localBoundary: {
    unauthenticatedDenied: boolean;
    unauthenticated: Record<string, unknown>;
    authenticated: Record<string, unknown>;
  };

  try {
    const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

    session = {};
    const unauthenticated = await requestCheckoutHttp(
      baseUrl,
      validInput({ customer_id: "client-selected" })
    );
    assertError(unauthenticated, 401, "checkout_auth_required");

    session = { auth_context: authContext(customerId) };
    const authenticated = await requestCheckoutHttp(baseUrl, validInput());
    assert.equal(authenticated.statusCode, 200);
    assert.equal(authenticated.body.snapshot.name, "Synthetic Buyer");
    assert.equal("customer_id" in authenticated.body.snapshot, false);

    localBoundary = {
      unauthenticatedDenied: true,
      unauthenticated: {
        status: unauthenticated.statusCode,
        code: unauthenticated.body.error.code,
        envelope: "shared-sanitized",
      },
      authenticated: {
        status: authenticated.statusCode,
        actorDerived: "customer_id" in authenticated.body.snapshot === false,
        transport: "real local HTTP route with synthetic Medusa session context",
      },
    };
  } finally {
    await closeServer(server);
  }

  const before = await countCheckoutMutationRecords(container);
  const runningServer = await startCompiledMedusa();
  let sessionCookie: string | undefined;
  try {
    const jwtSecret = resolveJwtSecret(container);
    const bearerToken = generateJwtToken(authContext(customerId), {
      secret: jwtSecret,
      expiresIn: "5m",
    });
    const baseUrl = runningServer.baseUrl;
    const commonHeaders = {
      "content-type": "application/json",
      "x-publishable-api-key": publishableKey,
    };

    const guest = await requestCheckoutHttp(baseUrl, validInput(), {
      headers: commonHeaders,
    });
    assertError(guest, 401, "checkout_auth_required");

    const authenticated = await requestCheckoutHttp(baseUrl, validInput(), {
      headers: {
        ...commonHeaders,
        authorization: `Bearer ${bearerToken}`,
      },
    });
    assert.equal(authenticated.statusCode, 200);
    assert.equal("customer_id" in authenticated.body.snapshot, false);

    const clientIdentity = await requestCheckoutHttp(
      baseUrl,
      validInput({ customer_id: "client-selected" }),
      {
        headers: {
          ...commonHeaders,
          authorization: `Bearer ${bearerToken}`,
        },
      }
    );
    assertError(clientIdentity, 400, "checkout_invalid_request");

    sessionCookie = await createMedusaSessionCookie(
      baseUrl,
      bearerToken,
      publishableKey
    );
    const sessionAuthenticated = await requestCheckoutHttp(
      baseUrl,
      validInput(),
      {
        headers: {
          ...commonHeaders,
          cookie: sessionCookie,
        },
      }
    );
    assert.equal(sessionAuthenticated.statusCode, 200);
    assert.equal("customer_id" in sessionAuthenticated.body.snapshot, false);

    const after = await countCheckoutMutationRecords(container);
    assert.deepEqual(after, before);

    return {
      ...localBoundary!,
      realMedusaGuest: {
        status: guest.statusCode,
        code: guest.body.error.code,
        envelope: "shared-sanitized",
      },
      realMedusaAuthenticated: {
        status: authenticated.statusCode,
        actorDerived: "customer_id" in authenticated.body.snapshot === false,
        authorization: "synthetic customer bearer",
      },
      realMedusaSessionAuthenticated: {
        status: sessionAuthenticated.statusCode,
        actorDerived: "customer_id" in sessionAuthenticated.body.snapshot === false,
        authorization: "synthetic Medusa session cookie",
      },
      realMedusaOwnership: {
        clientIdentityRejected: true,
        authority: "standard Medusa actor context",
      },
      realMedusaRuntime: {
        server: "compiled Medusa medusa start",
        routeLoader: true,
        publishableKey: "synthetic local publishable key",
        parser: "standard Medusa body parser; malformed JSON normalization deferred",
        noMutation: { before, after, unchanged: true },
      },
    };
  } finally {
    if (sessionCookie) {
      await destroyMedusaSession(runningServer.baseUrl, sessionCookie);
    }
    await stopCompiledMedusa(runningServer.process);
  }
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
      origin: "http://127.0.0.1:8000",
      "x-publishable-api-key": publishableKey,
    },
  });
  const responseBody = await response.text();
  assert.equal(response.status, 200, responseBody);
  const setCookie = response.headers.getSetCookie?.()[0] ?? response.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /^connect\.sid=/i);
  return setCookie.split(";", 1)[0];
}

async function destroyMedusaSession(baseUrl: string, cookie: string) {
  const response = await fetch(`${baseUrl}/auth/session`, {
    method: "DELETE",
    headers: {
      cookie,
      origin: "http://127.0.0.1:8000",
    },
  });
  const responseBody = await response.text();
  assert.equal(response.status, 200, responseBody);
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

async function countCheckoutMutationRecords(container: ExecArgs["container"]) {
  const orderModule = container.resolve(Modules.ORDER) as any;
  const paymentModule = container.resolve(Modules.PAYMENT) as any;
  const inventoryModule = container.resolve(Modules.INVENTORY) as any;
  const [, orders] = await orderModule.listAndCountOrders({}, { take: 1 });
  const [, paymentCollections] = await paymentModule.listAndCountPaymentCollections(
    {},
    { take: 1 }
  );
  const [, reservationItems] = await inventoryModule.listAndCountReservationItems(
    {},
    { take: 1 }
  );
  return { orders, paymentCollections, reservationItems };
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
      env: { ...process.env, NODE_ENV: "development", PORT: String(port) },
      stdio: ["ignore", "ignore", "ignore"],
      windowsHide: true,
    }
  );

  try {
    await waitForHttpHealth(child, `http://127.0.0.1:${port}/health`);
    return { process: child, baseUrl: `http://127.0.0.1:${port}` };
  } catch (error) {
    await stopCompiledMedusa(child);
    throw error;
  }
}

async function waitForHttpHealth(child: ChildProcess, url: string) {
  let exited = false;
  child.once("exit", () => {
    exited = true;
  });

  for (let attempt = 0; attempt < 240; attempt += 1) {
    if (exited) throw new Error("Compiled Medusa server exited before health check.");
    try {
      const response = await fetch(url);
      if (response.status === 200) return;
    } catch {
      // The compiled server may still be initializing its container.
    }
    await delay(250);
  }

  throw new Error("Compiled Medusa server did not become ready locally.");
}

async function stopCompiledMedusa(child: ChildProcess) {
  if (child.exitCode !== null || child.killed) return;

  const exited = new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
  });
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

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function cleanupPreviousSyntheticApiKeys(
  container: ExecArgs["container"],
  apiKeyModule: IApiKeyModuleService
) {
  const apiKeys = (await apiKeyModule.listApiKeys({
    q: "TASK-047 synthetic publishable key",
  })).filter(
    (apiKey) =>
      apiKey.type === "publishable" &&
      apiKey.title.startsWith("TASK-047 synthetic publishable key ")
  );

  if (apiKeys.length === 0) return;

  for (const apiKey of apiKeys) {
    if (!apiKey.revoked_at) {
      await apiKeyModule.revoke(apiKey.id, {
        revoked_by: "task-047-local-recovery",
      });
    }
  }

  await deleteApiKeysWorkflow(container).run({
    input: { ids: apiKeys.map((apiKey) => apiKey.id) },
  });
}

function findCheckoutMiddlewareRoute() {
  const route = (checkoutMiddlewares.routes || []).find(
    (candidate) =>
      candidate.matcher === "/store/checkout" &&
      (candidate.method ?? candidate.methods)?.includes("POST")
  );
  assert.ok(route, "Missing checkout authentication middleware.");
  assert.equal(route.middlewares?.length, 1);
  return route as { middlewares: NonNullable<typeof route.middlewares> };
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
  return {
    statusCode: response.status,
    body: await response.json(),
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

async function cleanupCheckoutFixtures({
  container,
  customerModule,
  apiKeyModule,
  fulfillment,
  createdCustomerIds,
  createdOptionIds,
  createdApiKeyIds,
  serviceZoneId,
  fulfillmentSetId,
  stockLocationId,
}: {
  container: ExecArgs["container"];
  customerModule: ICustomerModuleService;
  apiKeyModule: IApiKeyModuleService;
  fulfillment: any;
  createdCustomerIds: string[];
  createdOptionIds: string[];
  createdApiKeyIds: string[];
  serviceZoneId: string | undefined;
  fulfillmentSetId: string | undefined;
  stockLocationId: string | undefined;
}) {
  const failures: string[] = [];
  const attempt = async (label: string, action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      failures.push(`${label}:${error instanceof Error ? error.name : "unknown"}`);
    }
  };

  if (createdApiKeyIds.length > 0) {
    await attempt("publishable_api_key_revoke", () =>
      Promise.all(
        createdApiKeyIds.map((id) =>
          apiKeyModule.revoke(id, {
            revoked_by: "task-047-local-smoke",
          })
        )
      )
    );
    await attempt("publishable_api_keys", () =>
      deleteApiKeysWorkflow(container).run({
        input: { ids: createdApiKeyIds },
      })
    );
  }
  if (createdOptionIds.length > 0) {
    await attempt("shipping_options", () =>
      fulfillment.deleteShippingOptions(createdOptionIds)
    );
  }
  if (serviceZoneId) {
    await attempt("service_zone", () =>
      fulfillment.deleteServiceZones(serviceZoneId)
    );
  }
  if (fulfillmentSetId) {
    await attempt("fulfillment_set", () =>
      fulfillment.deleteFulfillmentSets(fulfillmentSetId)
    );
  }
  if (stockLocationId) {
    await attempt("stock_location", () =>
      deleteStockLocationsWorkflow(container).run({
        input: { ids: [stockLocationId] },
      })
    );
  }
  for (const [index, customerId] of createdCustomerIds.entries()) {
    await attempt(`customer_${index}`, () =>
      customerModule.deleteCustomers(customerId)
    );
  }

  if (failures.length > 0) {
    process.stderr.write(
      `${JSON.stringify({
        suite: "checkout-delivery",
        status: "cleanup_failed",
        failures,
        productionData: false,
      })}\n`
    );
    throw new Error("TASK-047 synthetic fixture cleanup failed.");
  }
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

async function callCheckout(
  scope: any,
  auth_context: Record<string, unknown> | undefined,
  body: Record<string, unknown>
): Promise<RouteResult> {
  const response = new TestResponse();
  await POST(
    {
      scope,
      body,
      validatedBody: body,
      ...(auth_context ? { auth_context } : {}),
    } as any,
    response as any
  );
  return response.result();
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

function assertCheckoutMiddleware() {
  findCheckoutMiddlewareRoute();

  const repositoryRoot = path.resolve(process.cwd(), "..", "..");
  const source = fs.readFileSync(
    path.join(repositoryRoot, "apps/backend/src/api/middlewares.ts"),
    "utf8"
  );
  assert.match(
    source,
    /standardCheckoutAuthentication = authenticate\("customer", \[\s*"session",\s*"bearer",?\s*\]\)/
  );
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
  const checkoutSource = `${routeSource}\n${workflowSource}`;
  assert.doesNotMatch(
    checkoutSource,
    /Modules\.(ORDER|INVENTORY|PAYMENT)|createOrder|reserveInventory|paymentProvider|providerRequest/i
  );
  assert.match(checkoutSource, /resolveCheckoutDeliveryOptions/);
  assert.match(checkoutSource, /payment_id/);
  assert.match(checkoutSource, /snapshot/);
}

function createReadOnlyScope(container: ExecArgs["container"]) {
  const operations: string[] = [];
  const mutations: string[] = [];
  const forbiddenResolves: string[] = [];
  const forbiddenKeys = [
    Modules.ORDER,
    Modules.INVENTORY,
    Modules.PAYMENT,
  ];
  const mutationNames = /^(create|update|delete|set|reserve|capture|authorize|cancel)/i;

  const scope = new Proxy(container as any, {
    get(target, property, receiver) {
      if (property === "resolve") {
        return (key: string) => {
          if ((forbiddenKeys as readonly string[]).includes(key)) {
            forbiddenResolves.push(key);
          }
          const resolved = target.resolve(key);
          if (key === Modules.FULFILLMENT) {
            return new Proxy(resolved, {
              get(service, serviceProperty, serviceReceiver) {
                if (typeof serviceProperty === "string") {
                  if (mutationNames.test(serviceProperty)) {
                    mutations.push(`fulfillment.${serviceProperty}`);
                  }
                  if (serviceProperty === "listShippingOptionsForContext") {
                    operations.push(
                      "fulfillment.listShippingOptionsForContext"
                    );
                  }
                }
                const value = Reflect.get(service, serviceProperty, serviceReceiver);
                return typeof value === "function" ? value.bind(service) : value;
              },
            });
          }
          if (key === "remoteQuery") {
            return async (...args: unknown[]) => {
              operations.push("remoteQuery");
              return resolved(...args);
            };
          }
          return resolved;
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });

  return { scope, operations, mutations, forbiddenResolves };
}

class TestResponse {
  statusCode = 200;
  body: any;

  status(statusCode: number) {
    this.statusCode = statusCode;
    return this;
  }

  json(body: unknown) {
    this.body = body;
    return this;
  }

  result(): RouteResult {
    return { statusCode: this.statusCode, body: this.body };
  }
}
