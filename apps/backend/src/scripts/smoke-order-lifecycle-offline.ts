import assert from "node:assert/strict";
import { assertNativeLifecyclePrecondition, loadNativeLifecycleOrder, nativeLifecycleSnapshot, type NativeLifecycleOrder } from "../order-lifecycle/native-order";
import { projectOrderLifecycle } from "../order-lifecycle/projection";

async function main() {
  const order: NativeLifecycleOrder = {
    id: "order_offline", status: "pending", currency_code: "rub",
    metadata: { checkout_state: "pending_payment", pending_payment_expires_at: "2099-01-01T00:00:00Z" },
    payment_collections: [{ id: "paycol_offline", status: "completed", payments: [{
      id: "pay_offline", payment_collection_id: "paycol_offline", captured_at: "2026-01-01T00:00:00Z",
      captures: [{ amount: 100 }], refunds: [],
    }] }],
  };
  assert.throws(() => assertNativeLifecyclePrecondition({ ...order, status: "canceled" }, "payment"));
  assert.throws(() => assertNativeLifecyclePrecondition({ ...order, status: "completed" }, "payment"));
  assert.throws(() => assertNativeLifecyclePrecondition(order, "payment"));
  assert.doesNotThrow(() => assertNativeLifecyclePrecondition(order, "fulfillment"));
  const paid = nativeLifecycleSnapshot(order);
  assert.equal(projectOrderLifecycle({ snapshot: paid, event: { order_id: order.id, event: "payment_marked_paid" } }).state, "paid");
  const completed = nativeLifecycleSnapshot({ ...order, status: "completed", fulfillments: [{ id: "ful_offline" }] });
  assert.equal(projectOrderLifecycle({ snapshot: completed, event: { order_id: order.id, event: "order_completed" } }).state, "completed");
  const refunded = structuredClone(order);
  refunded.payment_collections![0].payments![0].refunds = [{ amount: 100 }];
  assert.equal(projectOrderLifecycle({ snapshot: nativeLifecycleSnapshot(refunded), event: { order_id: order.id, event: "payment_refunded" } }).state, "refunded");
  assert.equal(projectOrderLifecycle({ snapshot: nativeLifecycleSnapshot({ ...refunded, status: "canceled" }), event: { order_id: order.id, event: "payment_refunded" } }).state, "canceled");
  let requested: any;
  const container = { resolve: () => ({ graph: async (input: any) => { requested = input; return { data: [order] }; } }) } as any;
  assert.equal(await loadNativeLifecycleOrder(container, order.id), order);
  assert.equal(requested.entity, "order");
  assert(requested.fields.includes("payment_collections.payments.captured_at"));
  assert(!requested.fields.includes("payment_collections.payments.status"));
  console.log(JSON.stringify({ status: "ok", sourceBoundary: "project-lifecycle-with-controlled-native-records", runtimeVerified: false }));
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
