import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import http from "node:http";
import path from "node:path";

import type { ExecArgs, ICustomerModuleService } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  generateJwtToken,
  Modules,
} from "@medusajs/framework/utils";
import {
  cancelOrderWorkflow,
  createOrderPaymentCollectionWorkflow,
  createOrderWorkflow,
  createUsersWorkflow,
} from "@medusajs/medusa/core-flows";

import { findExpiredPendingOrders, runExpirePendingOrdersJob } from "../jobs/expire-pending-orders";
import { pendingOrderExpiresAt } from "../checkout/pending-order";
import { expirePendingOrderWorkflow } from "../workflows/checkout/expire-pending-order";

const COMPILED_HEALTH_TIMEOUT_MS = 180_000;
const HEALTH_POLL_INTERVAL_MS = 250;

const NOW = new Date("2026-08-16T12:00:00.000Z");

type FixtureOrder = {
  id: string;
  lineItemId?: string;
  reservationIds: string[];
};

export default async function smokePendingOrderExpiry({ container }: ExecArgs) {
  assert.notEqual(
    process.env.NODE_ENV,
    "production",
    "TASK-051 smoke is local-only and refuses production mode."
  );

  const orderModule = container.resolve(Modules.ORDER) as any;
  const inventoryModule = container.resolve(Modules.INVENTORY) as any;
  const customerModule = container.resolve<ICustomerModuleService>(Modules.CUSTOMER);
  const customer = await customerModule.createCustomers({
    email: `task051_${process.pid}_${Date.now()}@example.test`,
    first_name: "TASK-051",
    last_name: "Synthetic",
    has_account: true,
  });
  const createdOrders: FixtureOrder[] = [];

  try {
    process.stderr.write("TASK-051 fixture:start\n");
    const variant = await loadSellableVariant(container);
    process.stderr.write("TASK-051 fixture:variant\n");
    const expired = await createFixtureOrder({
      container,
      customerId: customer.id,
      variant,
      state: "pending_payment",
      expiresAt: "2026-08-15T12:00:00.000Z",
      reservations: 2,
      createdOrders,
    });
    process.stderr.write("TASK-051 fixture:expired\n");
    const paid = await createFixtureOrder({
      container,
      customerId: customer.id,
      variant,
      state: "paid",
      expiresAt: "2026-08-15T12:00:00.000Z",
      reservations: 1,
      createdOrders,
    });
    process.stderr.write("TASK-051 fixture:paid\n");
    const future = await createFixtureOrder({
      container,
      customerId: customer.id,
      variant,
      state: "pending_payment",
      expiresAt: "2026-08-17T12:00:00.000Z",
      reservations: 1,
      createdOrders,
    });
    process.stderr.write("TASK-051 fixture:future\n");
    const canceled = await createFixtureOrder({
      container,
      customerId: customer.id,
      variant,
      state: "pending_payment",
      expiresAt: "2026-08-15T12:00:00.000Z",
      reservations: 0,
      createdOrders,
    });
    process.stderr.write("TASK-051 fixture:canceled-created\n");
    await cancelOrderWorkflow(container).run({ input: { order_id: canceled.id } });
    await orderModule.updateOrders(canceled.id, {
      metadata: { checkout_state: "canceled", pending_payment_expires_at: "2026-08-15T12:00:00.000Z" },
    });

    const recovery = await createFixtureOrder({
      container,
      customerId: customer.id,
      variant,
      state: "pending_payment",
      expiresAt: "2026-08-15T12:00:00.000Z",
      reservations: 0,
      createdOrders,
    });
    await cancelOrderWorkflow(container).run({ input: { order_id: recovery.id } });
    await orderModule.updateOrders(recovery.id, {
      metadata: {
        checkout_state: "expired",
        pending_payment_expires_at: "2026-08-15T12:00:00.000Z",
        checkout_expiry_cleanup: "pending",
      },
    });
    assert.ok(recovery.lineItemId, "The recovery fixture must have one line item.");
    const recoveryReservation = await inventoryModule.createReservationItems({
      line_item_id: recovery.lineItemId,
      inventory_item_id: variant.inventoryItemId,
      location_id: variant.locationId,
      quantity: 1,
      allow_backorder: true,
      created_by: "ft-007:task-051-smoke-recovery",
      metadata: {
        order_id: recovery.id,
        state: "reserved",
        expires_at: "2026-08-15T12:00:00.000Z",
      },
    });
    recovery.reservationIds.push(recoveryReservation.id);
    process.stderr.write("TASK-051 fixture:recovery\n");

    const nonPending = await createFixtureOrder({
      container,
      customerId: customer.id,
      variant,
      state: "pending_payment",
      expiresAt: "2026-08-15T12:00:00.000Z",
      reservations: 0,
      createdOrders,
    });
    process.stderr.write("TASK-051 fixture:non-pending-created\n");
    await orderModule.updateOrders(nonPending.id, { status: "completed" });

    assert.equal(pendingOrderExpiresAt(new Date("2026-08-16T12:00:00.000Z")), "2026-08-19T12:00:00.000Z");
    const allOrders = await orderModule.listOrders({}, { relations: ["items"], take: null });
    const selectedIds = new Set(findExpiredPendingOrders(allOrders, NOW).map((order: any) => order.id));
    assert.equal(selectedIds.has(expired.id), true);
    assert.equal(selectedIds.has(paid.id), false);
    assert.equal(selectedIds.has(future.id), false);
    assert.equal(selectedIds.has(canceled.id), false);
    assert.equal(selectedIds.has(nonPending.id), false);
    assert.equal(selectedIds.has(recovery.id), true);

    await assert.rejects(
      () =>
        expirePendingOrderWorkflow(container).run({
          input: {
            order_id: recovery.id,
            now: NOW.toISOString(),
            simulate_partial_cleanup_failure: true,
          },
        }),
      (error: unknown) => {
        assert.match(
          workflowErrorMessage(error),
          /simulated partial cleanup failure/
        );
        return true;
      }
    );
    assert.equal((await inventoryForOrder(inventoryModule, recovery.id)).length, 1);
    assert.equal((await orderModule.retrieveOrder(recovery.id)).status, "canceled");
    assert.equal(
      (await orderModule.retrieveOrder(recovery.id)).metadata.checkout_expiry_cleanup,
      "pending"
    );

    const partiallyCleanedReservation = expired.reservationIds[0];
    await inventoryModule.deleteReservationItems(partiallyCleanedReservation);
    assert.equal(
      (await inventoryForOrder(inventoryModule, expired.id)).length,
      expired.reservationIds.length - 1
    );

    const jobResult = await runExpirePendingOrdersJob(container, NOW);
    process.stderr.write("TASK-051 expiry:job-complete\n");
    assert.equal(jobResult.completed, jobResult.selected);

    const expiredAfter = await orderModule.retrieveOrder(expired.id);
    assert.equal(expiredAfter.status, "canceled");
    assert.equal(expiredAfter.metadata.checkout_state, "expired");
    assert.equal(expiredAfter.metadata.checkout_expiry_origin, "ft-007");
    assert.equal(expiredAfter.metadata.checkout_expiry_cleanup, "complete");
    assert.equal((await inventoryForOrder(inventoryModule, expired.id)).length, 0);
    assert.equal((await inventoryForOrder(inventoryModule, recovery.id)).length, 0);
    assert.equal(
      (await orderModule.retrieveOrder(recovery.id)).metadata.checkout_expiry_cleanup,
      "complete"
    );
    assert.equal(
      (await orderModule.retrieveOrder(recovery.id)).metadata.checkout_expiry_origin,
      "ft-007"
    );

    const paidAfter = await orderModule.retrieveOrder(paid.id);
    assert.equal(paidAfter.status, "pending");
    assert.equal(paidAfter.metadata.checkout_state, "paid");
    assert.equal((await inventoryForOrder(inventoryModule, paid.id)).length, paid.reservationIds.length);
    assert.equal((await orderModule.retrieveOrder(future.id)).metadata.checkout_state, "pending_payment");
    assert.equal((await orderModule.retrieveOrder(canceled.id)).metadata.checkout_state, "canceled");
    assert.equal((await orderModule.retrieveOrder(nonPending.id)).status, "completed");

    const nativeAdminEvidence = await runNativeAdminLifecycleSmoke({
      container,
      customerId: customer.id,
      variant,
    });

    const retry = await expirePendingOrderWorkflow(container).run({
      input: { order_id: expired.id, now: NOW.toISOString() },
    });
    assert.equal(retry.result.action, "skip");
    assert.equal((await inventoryForOrder(inventoryModule, expired.id)).length, 0);

    process.stdout.write(
      `${JSON.stringify(
        {
          suite: "pending-order-expiry",
          status: "ok",
          sourceBoundary: "real-medusa-postgresql-job-workflow-order-inventory",
          clock: { now: NOW.toISOString(), ttlHours: 72, utc: true },
          selection: {
            expiredPendingSelected: true,
            paidUnchanged: true,
            canceledUnchanged: true,
            nonPendingUnchanged: true,
            futureUnchanged: true,
          },
          cleanup: {
            nativeCancellation: true,
            releaseBy: "order_line_id",
            partialStateRecovered: true,
            simulatedFailureRetried: true,
            repeatedExecutionNoOp: true,
            directStockMutation: false,
          },
          productionData: false,
          providerRequest: false,
          cleanupMode: "unconditional-finally",
          nativeAdmin: nativeAdminEvidence,
        },
        null,
        2
      )}\n`
    );
  } finally {
    const failures: string[] = [];
    const attempt = async (label: string, action: () => Promise<unknown>) => {
      try {
        await action();
      } catch (error) {
        failures.push(`${label}:${error instanceof Error ? error.name : "unknown"}`);
      }
    };

    const reservationIds = createdOrders.flatMap((order) => order.reservationIds);
    if (reservationIds.length) {
      await attempt("reservations", () => inventoryModule.deleteReservationItems(reservationIds));
    }
    if (createdOrders.length) {
      await attempt("orders", () => orderModule.deleteOrders(createdOrders.map((order) => order.id)));
    }
    await attempt("customer", () => customerModule.deleteCustomers([customer.id]));
    if (failures.length) {
      throw new Error(`TASK-051 synthetic fixture cleanup failed: ${failures.join(", ")}`);
    }
  }
}

async function loadSellableVariant(container: ExecArgs["container"]) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any;
  const { data } = await query.graph({
    entity: "variants",
    fields: [
      "id",
      "manage_inventory",
      "inventory_items.inventory_item_id",
      "inventory_items.inventory.location_levels.location_id",
    ],
    filters: { manage_inventory: true },
  });
  const variant = (data ?? []).find((candidate: any) => {
    const inventoryItem = candidate.inventory_items?.[0];
    return (
      typeof candidate.id === "string" &&
      typeof inventoryItem?.inventory_item_id === "string" &&
      typeof inventoryItem?.inventory?.location_levels?.[0]?.location_id === "string"
    );
  });
  assert.ok(variant, "A managed inventory variant is required.");
  return {
    id: variant.id as string,
    inventoryItemId: variant.inventory_items[0].inventory_item_id as string,
    locationId: variant.inventory_items[0].inventory.location_levels[0].location_id as string,
  };
}

async function createFixtureOrder({
  container,
  customerId,
  variant,
  state,
  expiresAt,
  reservations,
  createdOrders,
}: {
  container: ExecArgs["container"];
  customerId: string;
  variant: { id: string; inventoryItemId: string; locationId: string };
  state: string;
  expiresAt: string;
  reservations: number;
  createdOrders: FixtureOrder[];
}) {
  const storeModule = container.resolve(Modules.STORE) as any;
  const regionModule = container.resolve(Modules.REGION) as any;
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL) as any;
  const [store] = await storeModule.listStores();
  const [region] = await regionModule.listRegions({ currency_code: "rub" });
  const [salesChannel] = await salesChannelModule.listSalesChannels({ name: "Default Sales Channel" });
  const { result: order } = await createOrderWorkflow(container).run({
    input: {
      region_id: region.id,
      sales_channel_id: salesChannel.id ?? store.default_sales_channel_id,
      customer_id: customerId,
      email: "task051.synthetic@example.test",
      currency_code: "rub",
      status: "pending",
      no_notification: true,
      items: [{ variant_id: variant.id, quantity: 1 }],
      metadata: {
        checkout_state: state,
        pending_payment_expires_at: expiresAt,
        checkout_expiry_cleanup: "none",
      },
    } as any,
  });
  const lineItemId = order.items?.[0]?.id;
  assert.ok(lineItemId, "The native fixture order must have one line item.");
  const reservationIds: string[] = [];
  const inventoryModule = container.resolve(Modules.INVENTORY) as any;
  for (let index = 0; index < reservations; index += 1) {
    const reservation = await inventoryModule.createReservationItems({
      line_item_id: lineItemId,
      inventory_item_id: variant.inventoryItemId,
      location_id: variant.locationId,
      quantity: 1,
      allow_backorder: true,
      created_by: "ft-007:task-051-smoke",
      metadata: { order_id: order.id, state: "reserved", expires_at: expiresAt },
    });
    reservationIds.push(reservation.id);
  }
  const fixture = { id: order.id, lineItemId, reservationIds };
  createdOrders.push(fixture);
  return fixture;
}

async function inventoryForOrder(inventoryModule: any, orderId: string) {
  return inventoryModule.listReservationItems({ metadata: { order_id: orderId } });
}

async function runNativeAdminLifecycleSmoke({
  container,
  customerId,
  variant,
}: {
  container: ExecArgs["container"];
  customerId: string;
  variant: { id: string; inventoryItemId: string; locationId: string };
}) {
  const orderModule = container.resolve(Modules.ORDER) as any;
  const customerModule = container.resolve<ICustomerModuleService>(Modules.CUSTOMER);
  const userModule = container.resolve(Modules.USER) as any;
  const authModule = container.resolve(Modules.AUTH) as any;
  const createdOrders: FixtureOrder[] = [];
  let createdUserId: string | undefined;
  let createdAuthIdentityId: string | undefined;
  let server: { process: ChildProcess; baseUrl: string } | undefined;

  try {
    const runId = `${process.pid}_${Date.now()}`;
    const email = `task055_admin_${runId}@example.test`;
    const password = `Task055-${runId}-Password!`;
    const { result: users } = await createUsersWorkflow(container).run({
      input: {
        users: [
          {
            email,
            first_name: "TASK-055",
            last_name: "Synthetic Admin",
          },
        ],
      },
    });
    const admin = users[0];
    assert.ok(admin?.id, "Synthetic Admin user was not created.");
    createdUserId = admin.id;
    const registered = await authModule.register("emailpass", {
      actor_type: "user",
      body: { email, password },
    });
    assert.ok(registered.authIdentity?.id, "Synthetic Admin auth identity was not created.");
    createdAuthIdentityId = registered.authIdentity.id;
    await authModule.updateAuthIdentities({
      id: createdAuthIdentityId,
      app_metadata: { user_id: createdUserId },
    });

    const jwtSecret = resolveJwtSecret(container);
    const adminToken = generateJwtToken(
      {
        actor_id: createdUserId,
        actor_type: "user",
        auth_identity_id: createdAuthIdentityId,
        app_metadata: { user_id: createdUserId },
        user_metadata: {},
      },
      { secret: jwtSecret, expiresIn: "5m" }
    );
    const customerToken = generateJwtToken(
      {
        actor_id: customerId,
        actor_type: "customer",
        auth_identity_id: "task055-customer-auth",
        app_metadata: {},
        user_metadata: {},
      },
      { secret: jwtSecret, expiresIn: "5m" }
    );

    const paid = await createNativeOrderFixture({
      container,
      customerId,
      variant,
      state: "pending_payment",
      reservations: 1,
      createdOrders,
    });
    const paymentCollection = await createNativePaymentCollection(container, paid.id);
    server = await startCompiledMedusa();
    const adminHeaders = {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
    };
    const customerHeaders = {
      authorization: `Bearer ${customerToken}`,
      "content-type": "application/json",
    };

    const unauthenticated = await requestAdminHttp(
      server.baseUrl,
      `/admin/payment-collections/${paymentCollection.id}/mark-as-paid`,
      { order_id: paid.id },
      {}
    );
    assert.ok([401, 403].includes(unauthenticated.statusCode));
    const customerDenied = await requestAdminHttp(
      server.baseUrl,
      `/admin/payment-collections/${paymentCollection.id}/mark-as-paid`,
      { order_id: paid.id },
      customerHeaders
    );
    assert.ok([401, 403].includes(customerDenied.statusCode));

    const markPaid = await requestAdminHttp(
      server.baseUrl,
      `/admin/payment-collections/${paymentCollection.id}/mark-as-paid`,
      { order_id: paid.id },
      adminHeaders
    );
    assert.equal(markPaid.statusCode, 200, JSON.stringify(markPaid.body));
    const afterPaid = await waitForProjectedState(container, paid.id, "paid");
    assert.equal(afterPaid.metadata?.checkout_state, "paid");
    assert.equal(
      (await inventoryForOrder(container.resolve(Modules.INVENTORY) as any, paid.id)).length,
      1,
      "Native payment must preserve the reservation."
    );

    const protectedMetadata = await requestAdminHttp(
      server.baseUrl,
      `/admin/orders/${paid.id}`,
      { metadata: { ...afterPaid.metadata, checkout_state: "canceled" } },
      adminHeaders
    );
    assert.ok([400, 422].includes(protectedMetadata.statusCode));
    const unrelatedMetadata = await requestAdminHttp(
      server.baseUrl,
      `/admin/orders/${paid.id}`,
      { metadata: { ...afterPaid.metadata, operator_note: "allowed" } },
      adminHeaders
    );
    assert.equal(unrelatedMetadata.statusCode, 200, JSON.stringify(unrelatedMetadata.body));

    const fulfillment = await requestAdminHttp(
      server.baseUrl,
      `/admin/orders/${paid.id}/fulfillments`,
      { items: [{ id: paid.lineItemId, quantity: 1 }] },
      adminHeaders
    );
    assert.equal(fulfillment.statusCode, 200, JSON.stringify(fulfillment.body));
    const nativeFulfilled = await waitForProjectedState(container, paid.id, "processing");
    assert.ok((nativeFulfilled.fulfillments ?? []).length > 0);

    const complete = await requestAdminHttp(
      server.baseUrl,
      `/admin/orders/${paid.id}/complete`,
      {},
      adminHeaders
    );
    assert.equal(complete.statusCode, 200, JSON.stringify(complete.body));
    const nativeCompleted = await waitForProjectedState(container, paid.id, "completed");
    assert.equal(nativeCompleted.status, "completed");

    const payment = await findOrderPayment(container, paid.id);
    assert.ok(payment?.id, "The paid native order must expose a payment.");
    const refund = await requestAdminHttp(
      server.baseUrl,
      `/admin/payments/${payment.id}/refund`,
      {},
      adminHeaders
    );
    assert.equal(refund.statusCode, 200, JSON.stringify(refund.body));
    await waitForProjectedState(container, paid.id, "refunded");

    const cancelCandidate = await createNativeOrderFixture({
      container,
      customerId,
      variant,
      state: "pending_payment",
      reservations: 1,
      createdOrders,
    });
    await createNativePaymentCollection(container, cancelCandidate.id);
    const canceled = await requestAdminHttp(
      server.baseUrl,
      `/admin/orders/${cancelCandidate.id}/cancel`,
      {},
      adminHeaders
    );
    assert.equal(canceled.statusCode, 200, JSON.stringify(canceled.body));
    const canceledOrder = await retrieveOrderWithNativeState(container, cancelCandidate.id);
    assert.equal(canceledOrder.status, "canceled");

    return {
      nativeAdminBoundary: true,
      nativePaymentMarkAsPaid: true,
      nativeFulfillment: true,
      nativeCompletion: true,
      nativeRefund: true,
      reservationPreservedAfterPayment: true,
      authorizationDenials: { unauthenticated: true, customerActor: true },
      protectedMetadataDenied: true,
      unrelatedMetadataAllowed: true,
      nativeCancellation: true,
      concurrencyProtection: false,
      productionData: false,
      providerRequest: false,
    };
  } finally {
    if (server) await stopCompiledMedusa(server.process);
    if (createdOrders.length) {
      await orderModule.deleteOrders(createdOrders.map((order) => order.id)).catch(() => undefined);
    }
    if (createdAuthIdentityId) {
      await authModule.deleteAuthIdentities([createdAuthIdentityId]).catch(() => undefined);
    }
    if (createdUserId) {
      await userModule.deleteUsers([createdUserId]).catch(() => undefined);
    }
  }
}

async function createNativeOrderFixture({
  container,
  customerId,
  variant,
  state,
  reservations,
  createdOrders,
}: {
  container: ExecArgs["container"];
  customerId: string;
  variant: { id: string; inventoryItemId: string; locationId: string };
  state: string;
  reservations: number;
  createdOrders: FixtureOrder[];
}) {
  return createFixtureOrder({
    container,
    customerId,
    variant,
    state,
    expiresAt: "2026-08-17T12:00:00.000Z",
    reservations,
    createdOrders,
  });
}

async function createNativePaymentCollection(container: ExecArgs["container"], orderId: string) {
  const order = await (container.resolve(Modules.ORDER) as any).retrieveOrder(orderId);
  const { result } = await createOrderPaymentCollectionWorkflow(container).run({
    input: { order_id: orderId, amount: Number(order.total ?? order.summary?.total ?? 0) },
  });
  assert.ok(result?.[0]?.id, "Native payment collection was not created.");
  return result[0];
}

async function findOrderPayment(container: ExecArgs["container"], orderId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any;
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "payment_collections.payments.id"],
    filters: { id: orderId },
  });
  return data?.[0]?.payment_collections?.flatMap((collection: any) => collection.payments ?? [])[0];
}

async function retrieveOrderWithNativeState(container: ExecArgs["container"], orderId: string) {
  return (container.resolve(Modules.ORDER) as any).retrieveOrder(orderId, {
    relations: ["payment_collections", "payment_collections.payments", "fulfillments"],
  });
}

async function waitForProjectedState(
  container: ExecArgs["container"],
  orderId: string,
  expectedState: string
) {
  let lastOrder: any;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    lastOrder = await retrieveOrderWithNativeState(container, orderId);
    if (lastOrder.metadata?.checkout_state === expectedState) return lastOrder;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `Timed out waiting for projected state '${expectedState}' on ${orderId}; got '${lastOrder?.metadata?.checkout_state}'.`
  );
}

function resolveJwtSecret(container: ExecArgs["container"]): string {
  const config = container.resolve(ContainerRegistrationKeys.CONFIG_MODULE) as any;
  const secret = config.projectConfig?.http?.jwtSecret;
  assert.equal(typeof secret, "string");
  return secret;
}

async function requestAdminHttp(
  baseUrl: string,
  route: string,
  body: Record<string, unknown>,
  headers: Record<string, string>
) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  return { statusCode: response.status, body: parsed };
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
        MEDUSA_FILE_URL: process.env.MEDUSA_FILE_URL?.trim() || `http://127.0.0.1:${port}/static`,
      },
      stdio: ["ignore", "ignore", "inherit"],
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
  child.once("exit", () => (exited = true));
  const attempts = Math.ceil(COMPILED_HEALTH_TIMEOUT_MS / HEALTH_POLL_INTERVAL_MS);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (exited) throw new Error("Compiled Medusa server exited before health check.");
    try {
      if ((await fetch(url)).status === 200) return;
    } catch {
      // The local server is still initializing.
    }
    await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_INTERVAL_MS));
  }
  throw new Error("Compiled Medusa server did not become ready locally.");
}

async function stopCompiledMedusa(child: ChildProcess) {
  if (child.exitCode !== null || child.killed) return;
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  child.kill("SIGTERM");
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5_000))]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function reservePort() {
  const server = http.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return port;
}

function workflowErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error !== null) {
    const candidate = error as {
      message?: unknown;
      error?: unknown;
    };
    if (typeof candidate.message === "string") return candidate.message;
    if (candidate.message && candidate.message !== error) {
      return workflowErrorMessage(candidate.message);
    }
    if (candidate.error && candidate.error !== error) {
      return workflowErrorMessage(candidate.error);
    }
  }

  return String(error);
}
