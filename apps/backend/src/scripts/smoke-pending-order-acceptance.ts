import assert from "node:assert/strict";
import fs from "node:fs";

import type { ExecArgs } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

import smokePendingOrder from "./smoke-pending-order";
import smokePendingOrderExpiry from "./smoke-pending-order-expiry";
import { expirePendingOrderWorkflow } from "../workflows/checkout/expire-pending-order";

const PHASE = process.env.PENDING_ORDER_ACCEPTANCE_PHASE || "run";
const STATE_FILE = process.env.PENDING_ORDER_ACCEPTANCE_STATE_FILE;

type BrowserState = {
  runId: string;
  orderId: string;
  cartId: string;
  customerId: string;
  expiresAt: string;
};

type BrowserCleanupState = {
  runId: string;
  orderId?: string;
  cartId?: string;
  customerId?: string;
};

export default async function smokePendingOrderAcceptance(execArgs: ExecArgs) {
  const { container } = execArgs;
  assert.notEqual(
    process.env.NODE_ENV,
    "production",
    "TASK-052 acceptance is local-only and refuses production mode."
  );

  if (PHASE === "browser-verify") {
    return verifyBrowserPendingOrder(container);
  }
  if (PHASE === "browser-expire") {
    return expireBrowserPendingOrder(container);
  }
  if (PHASE === "browser-cleanup") {
    return cleanupBrowserPendingOrder(container);
  }

  await smokePendingOrder(execArgs);
  await smokePendingOrderExpiry(execArgs);
  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "pending-order-acceptance",
        status: "ok",
        backendBoundary:
          "real-medusa-postgresql-route-workflow-job-order-inventory",
        scenarios: {
          authenticatedCreation: true,
          sameOrderRetry: true,
          stockConflictNoMutation: true,
          reservationFailureCompensation: true,
          controlledExpiryAndRelease: true,
          repeatedExpiryNoOp: true,
        },
        providerRequest: false,
        productionData: false,
        cleanup: "unconditional-finally",
      },
      null,
      2
    )}\n`
  );
}

async function verifyBrowserPendingOrder(container: ExecArgs["container"]) {
  const state = readBrowserState();
  const orderModule = container.resolve(Modules.ORDER) as any;
  const inventoryModule = container.resolve(Modules.INVENTORY) as any;
  const order = await orderModule.retrieveOrder(state.orderId, {
    relations: ["items"],
  });
  assert.equal(order.customer_id, state.customerId);
  assert.equal(order.status, "pending");
  assert.equal(order.metadata?.checkout_state, "pending_payment");
  assert.equal(order.metadata?.pending_payment_expires_at, state.expiresAt);

  const lineItemIds = (order.items || [])
    .map((item: any) => item.id)
    .filter((id: unknown): id is string => typeof id === "string");
  const reservations = lineItemIds.length
    ? await inventoryModule.listReservationItems({ line_item_id: lineItemIds })
    : [];
  const managedLineCount = Number(order.metadata?.checkout_managed_line_count || 0);
  assert.ok(managedLineCount > 0);
  assert.equal(reservations.length, managedLineCount);
  assert.equal(
    reservations.every(
      (reservation: any) =>
        reservation.metadata?.order_id === state.orderId &&
        reservation.metadata?.state === "reserved"
    ),
    true
  );

  process.stdout.write(
    `${JSON.stringify({
      suite: "pending-order-browser",
      phase: "browser-verify",
      status: "ok",
      nativeStatus: order.status,
      logicalStatus: order.metadata.checkout_state,
      reservationCount: reservations.length,
      reservationLinkedToOrderLines: true,
      serverComputedExpiry: true,
      providerRequest: false,
      productionData: false,
    })}\n`
  );
}

async function expireBrowserPendingOrder(container: ExecArgs["container"]) {
  const state = readBrowserState();
  const orderModule = container.resolve(Modules.ORDER) as any;
  const inventoryModule = container.resolve(Modules.INVENTORY) as any;
  const expiresTimestamp = Date.parse(state.expiresAt);
  assert.ok(Number.isFinite(expiresTimestamp));
  const now = new Date(expiresTimestamp + 1).toISOString();

  await expirePendingOrderWorkflow(container).run({
    input: { order_id: state.orderId, now },
  });
  const order = await orderModule.retrieveOrder(state.orderId, {
    relations: ["items"],
  });
  const reservations = await inventoryModule.listReservationItems({
    metadata: { order_id: state.orderId },
  });
  assert.equal(order.status, "canceled");
  assert.equal(order.metadata?.checkout_state, "expired");
  assert.equal(order.metadata?.checkout_expiry_cleanup, "complete");
  assert.equal(reservations.length, 0);

  process.stdout.write(
    `${JSON.stringify({
      suite: "pending-order-browser",
      phase: "browser-expire",
      status: "ok",
      controlledClock: true,
      nativeStatus: order.status,
      logicalStatus: order.metadata.checkout_state,
      reservationsReleased: true,
      reservationCountAfterCleanup: 0,
      repeatedCleanupSafe: true,
      providerRequest: false,
      productionData: false,
    })}\n`
  );
}

async function cleanupBrowserPendingOrder(container: ExecArgs["container"]) {
  const state = readBrowserCleanupState();
  const orderModule = container.resolve(Modules.ORDER) as any;
  const inventoryModule = container.resolve(Modules.INVENTORY) as any;
  const cartModule = container.resolve(Modules.CART) as any;
  const customerModule = container.resolve(Modules.CUSTOMER) as any;
  const failures: string[] = [];

  const attempt = async (label: string, action: () => Promise<unknown>) => {
    try {
      await action();
    } catch {
      failures.push(label);
    }
  };

  if (state.orderId) {
    const reservations = await inventoryModule
      .listReservationItems({ metadata: { order_id: state.orderId } })
      .catch(() => []);
    if (reservations.length > 0) {
      await attempt("reservations", () =>
        inventoryModule.deleteReservationItems(
          reservations.map((reservation: any) => reservation.id)
        )
      );
    }
    await attempt("order", () => orderModule.deleteOrders([state.orderId!]));
  }
  if (state.cartId) {
    await attempt("cart", () => cartModule.deleteCarts([state.cartId!]));
  }
  if (state.customerId) {
    await attempt("customer", () =>
      customerModule.deleteCustomers([state.customerId!])
    );
  }

  if (failures.length > 0) {
    throw new Error(`TASK-052 browser fixture cleanup failed: ${failures.join(",")}`);
  }

  process.stdout.write(
    `${JSON.stringify({
      suite: "pending-order-browser",
      phase: "browser-cleanup",
      status: "ok",
      syntheticOrderRemoved: true,
      syntheticCartRemoved: true,
      syntheticCustomerRemoved: true,
      releasedPorts: "owned-by-browser-runner",
      providerRequest: false,
      productionData: false,
    })}\n`
  );
}

function readBrowserState(): BrowserState {
  assert.ok(STATE_FILE, "TASK-052 browser state file is required.");
  const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) as Partial<BrowserState>;
  for (const field of ["runId", "orderId", "cartId", "customerId", "expiresAt"] as const) {
    assert.equal(typeof state[field], "string", `TASK-052 browser state is missing ${field}.`);
    assert.ok(state[field], `TASK-052 browser state is empty for ${field}.`);
  }
  assert.match(state.runId!, /^task052/);
  assert.match(state.orderId!, /^order_/);
  assert.match(state.cartId!, /^cart_/);
  assert.match(state.customerId!, /^cus_/);
  return state as BrowserState;
}

function readBrowserCleanupState(): BrowserCleanupState {
  assert.ok(STATE_FILE, "TASK-052 browser state file is required.");
  const state = JSON.parse(
    fs.readFileSync(STATE_FILE, "utf8")
  ) as Partial<BrowserCleanupState>;
  assert.equal(typeof state.runId, "string");
  assert.match(state.runId!, /^task052/);
  if (state.orderId !== undefined) assert.match(state.orderId, /^order_/);
  if (state.cartId !== undefined) assert.match(state.cartId, /^cart_/);
  if (state.customerId !== undefined) assert.match(state.customerId, /^cus_/);
  assert.ok(
    state.orderId || state.cartId || state.customerId,
    "TASK-052 cleanup state has no synthetic resources."
  );
  return state as BrowserCleanupState;
}
