import assert from "node:assert/strict";

import type { ExecArgs, ICustomerModuleService } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  cancelOrderWorkflow,
  createOrderWorkflow,
} from "@medusajs/medusa/core-flows";

import { findExpiredPendingOrders, runExpirePendingOrdersJob } from "../jobs/expire-pending-orders";
import { pendingOrderExpiresAt } from "../checkout/pending-order";
import { expirePendingOrderWorkflow } from "../workflows/checkout/expire-pending-order";

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
    assert.equal(expiredAfter.metadata.checkout_expiry_cleanup, "complete");
    assert.equal((await inventoryForOrder(inventoryModule, expired.id)).length, 0);
    assert.equal((await inventoryForOrder(inventoryModule, recovery.id)).length, 0);
    assert.equal(
      (await orderModule.retrieveOrder(recovery.id)).metadata.checkout_expiry_cleanup,
      "complete"
    );

    const paidAfter = await orderModule.retrieveOrder(paid.id);
    assert.equal(paidAfter.status, "pending");
    assert.equal(paidAfter.metadata.checkout_state, "paid");
    assert.equal((await inventoryForOrder(inventoryModule, paid.id)).length, paid.reservationIds.length);
    assert.equal((await orderModule.retrieveOrder(future.id)).metadata.checkout_state, "pending_payment");
    assert.equal((await orderModule.retrieveOrder(canceled.id)).metadata.checkout_state, "canceled");
    assert.equal((await orderModule.retrieveOrder(nonPending.id)).status, "completed");

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
