import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import middlewareConfig from "../api/middlewares";
import { nativeLifecycleSnapshot } from "../order-lifecycle/native-order";
import { projectOrderLifecycle } from "../order-lifecycle/projection";
import type { OrderLifecycleEventKind } from "../order-lifecycle/types";

/**
 * Offline installed-source contract only. This does not load Medusa, query an
 * order, render Admin, or prove runtime authorization/payment/inventory behavior.
 */
export default async function smokeOrderAdminVisibilityContract() {
  const packagePath = require.resolve("@medusajs/dashboard/package.json");
  const dashboardRoot = path.dirname(packagePath);
  const dashboardPackage = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  assert.equal(dashboardPackage.version, "2.16.0", "Review the Admin contract for the installed version.");

  const checkedFiles: string[] = [];
  const read = (relativePath: string) => {
    checkedFiles.push(relativePath);
    return fs.readFileSync(path.join(dashboardRoot, relativePath), "utf8");
  };

  const constants = read("src/routes/orders/order-detail/constants.ts");
  const properties = stringArray(constants, "DEFAULT_PROPERTIES");
  const relations = stringArray(constants, "DEFAULT_RELATIONS");
  for (const field of ["id", "email", "status", "total", "metadata", "currency_code"]) {
    assert.ok(properties.includes(field), `Admin order detail must request ${field}.`);
  }
  for (const field of [
    "*customer", "*items", "*items.variant", "*items.variant.product",
    "*shipping_address", "*shipping_methods", "*fulfillments",
    "*payment_collections", "*payment_collections.payments",
    "*payment_collections.payments.refunds",
  ]) {
    assert.ok(relations.includes(field), `Admin order detail must request ${field}.`);
  }
  assert.match(constants, /export const DEFAULT_FIELDS\s*=\s*`\$\{DEFAULT_PROPERTIES\.join\(\s*","\s*\)\},\$\{DEFAULT_RELATIONS\.join\(","\)\}`/);

  const detail = read("src/routes/orders/order-detail/order-detail.tsx");
  assert.match(detail, /fields:\s*DEFAULT_FIELDS/);
  assert.match(detail, /<TwoColumnPage\s[\s\S]*?data=\{order\}[\s\S]*?\bshowJSON\b[\s\S]*?\bshowMetadata\b/);

  const routes = read("src/dashboard-app/routes/get-route.map.tsx");
  assert.match(routes, /path:\s*"metadata\/edit",\s*lazy:\s*\(\)\s*=>\s*import\("\.\.\/\.\.\/routes\/orders\/order-metadata"\)/);
  const metadata = read("src/routes/orders/order-metadata/order-metadata.tsx");
  assert.match(metadata, /fields:\s*"id,metadata"/);
  assert.match(metadata, /useUpdateOrder\(order\?\.id!\)/);
  assert.match(metadata, /<MetadataForm\s[\s\S]*?metadata=\{order\?\.metadata\}[\s\S]*?hook=\{mutateAsync\}/);

  const paymentHook = read("src/hooks/api/payment-collections.tsx");
  assert.match(paymentHook, /sdk\.admin\.paymentCollection\.markAsPaid\(paymentCollectionId,\s*payload\)/);
  const summary = read("src/routes/orders/order-detail/components/order-summary-section/order-summary-section.tsx");
  assert.match(summary, /useMarkPaymentCollectionAsPaid\(\s*order\.id,\s*unpaidPaymentCollection\?\.id!\s*\)/);
  assert.match(summary, /await markAsPaid\(\s*\{\s*order_id:\s*order\.id\s*\}/);
  const orderHook = read("src/hooks/api/orders.tsx");
  assert.match(orderHook, /sdk\.admin\.order\.cancel\(orderId\)/);

  await checkControlledOrders();

  process.stdout.write(`${JSON.stringify({
    suite: "order-admin-visibility-contract",
    status: "ok",
    sourceBoundary: "installed-medusa-admin-source-contract",
    runtimeVerified: false,
    dashboardVersion: dashboardPackage.version,
    checkedFiles,
    checks: ["order-detail-request-fields", "metadata-display-and-editor-wiring", "native-mark-as-paid-order-binding", "native-cancel-hook", "controlled-native-shaped-field-preservation", "manual-and-legacy-label-preservation", "registered-metadata-guard-change-delete-add-negatives"],
    controlledBoundary: "project-snapshot-projector-and-registered-middleware-with-query-double",
    deferred: ["real-order-payload", "rendered-admin-fields", "authorization", "protected-metadata-runtime-enforcement", "payment-and-inventory-mutations"],
  }, null, 2)}\n`);
}

async function checkControlledOrders() {
  const protectedValues = {
    checkout_state: "pending_payment",
    pending_payment_expires_at: "2099-01-01T00:00:00Z",
    checkout_cart_id: "cart_synthetic", checkout_idempotency_key: "synthetic",
    checkout_request_fingerprint: "synthetic", checkout_delivery_method: "courier",
    checkout_payment_method: "personal_request", checkout_customer_comment: "Synthetic",
    checkout_managed_line_count: 1,
    checkout_reservation_item_ids: ["resitem_synthetic"],
    checkout_reservation_line_ids: ["ordli_synthetic"],
    checkout_expiry_origin: "ft-007", checkout_expiry_reason: "payment_timeout",
    checkout_expiry_cleanup: "pending",
  };
  const route = middlewareConfig.routes?.find((route) => route.matcher === "/admin/orders/:id");
  assert.ok(route, "Generic native Admin order update must have a server guard.");
  assert.ok(route.methods?.includes("POST"));
  assert.ok(route.middlewares?.length);
  const guard = route.middlewares[0] as Function;
  const submit = async (current: Record<string, unknown>, metadata: unknown) => {
    let nextCalls = 0;
    await guard({
      params: { id: "order_synthetic" }, path: "/admin/orders/order_synthetic",
      body: { metadata }, scope: { resolve: () => ({ graph: async () => ({ data: [{
        id: "order_synthetic", status: "pending", currency_code: "rub", metadata: current,
      }] }) }) },
    }, {}, () => { nextCalls++; });
    assert.equal(nextCalls, 1);
  };
  await submit(protectedValues, structuredClone(protectedValues));
  await submit(protectedValues, { ...protectedValues, operator_note: "Synthetic editable note" });
  await submit(protectedValues, undefined);
  for (const key of Object.keys(protectedValues)) {
    const removed: Record<string, unknown> = { ...protectedValues };
    delete removed[key];
    await assert.rejects(submit(protectedValues, removed), /cannot be changed or deleted/);
    await assert.rejects(submit(protectedValues, { ...protectedValues, [key]: "forged" }), /cannot be changed or deleted/);
    await assert.rejects(submit(protectedValues, { ...protectedValues, [key]: null }), /cannot be changed or deleted/);
    await assert.rejects(submit(removed, protectedValues), /cannot be changed or deleted/);
  }
  for (const invalid of [null, [], "invalid"]) {
    await assert.rejects(submit(protectedValues, invalid), /preserved as an object/);
  }

  // Synthetic values exercise real project helpers, not a persisted/Admin payload.
  for (const method of ["personal_request", "card", "sbp", "sberpay"]) {
    const { checkout_expiry_origin, checkout_expiry_reason, checkout_expiry_cleanup, ...metadata } = protectedValues;
    const order = {
      id: "order_synthetic", status: "pending", currency_code: "rub", total: 1000,
      email: "buyer@example.invalid",
      shipping_address: { first_name: "Synthetic", phone: "+70000000000", address_1: "Synthetic street", city: "Synthetic", country_code: "ru" },
      items: [{ id: "ordli_synthetic", title: "Synthetic product", quantity: 1, variant: { id: "variant_synthetic", product: { id: "prod_synthetic" } } }],
      shipping_methods: [{ name: "Synthetic courier", amount: 500, data: { method_id: "courier" } }],
      metadata: { ...metadata, checkout_payment_method: method },
      payment_collections: [{ id: "paycol_synthetic", status: "not_paid", payments: [{
        id: "pay_synthetic", payment_collection_id: "paycol_synthetic", provider_id: "pp_system_default",
        captured_at: null as string | null, captures: [] as { amount: number }[], refunds: [] as { amount: number }[],
      }] }], fulfillments: [] as { id: string }[],
    };
    const baseline = structuredClone(order);
    const project = (event: OrderLifecycleEventKind, expected: string) => {
      const before = structuredClone(order);
      const result = projectOrderLifecycle({ snapshot: nativeLifecycleSnapshot(order), event: { order_id: order.id, event } });
      assert.equal(result.state, expected);
      assert.equal(result.native_order_status, order.status);
      // Snapshot retains collection status; capture/refund records decide logical state.
      assert.equal(result.payment_status, order.payment_collections[0].status);
      assert.equal(result.fulfillment_status, order.fulfillments.length ? "processing" : "none");
      assert.deepEqual(order, before, "Projector must not mutate native visible data.");
      order.metadata = result.metadata as typeof order.metadata;
      const { checkout_state: _state, ...preserved } = order.metadata;
      const { checkout_state: _baselineState, ...original } = baseline.metadata;
      assert.deepEqual(preserved, original);
      for (const field of ["email", "shipping_address", "items", "shipping_methods", "total", "currency_code"] as const) {
        assert.deepEqual(order[field], baseline[field]);
      }
      assert.equal(order.metadata.checkout_payment_method, method);
    };
    assert.equal(order.payment_collections[0].payments[0].captures.length, 0, "Payment choice alone is not capture evidence.");
    assert.throws(() => projectOrderLifecycle({
      snapshot: nativeLifecycleSnapshot(order),
      event: { order_id: order.id, event: "payment_marked_paid" },
    }), /payment|paid|capture/i, "A manual/legacy selection cannot supply payment evidence.");
    const unpaid = structuredClone(order);
    const payment = order.payment_collections[0].payments[0];
    payment.captured_at = "2026-01-01T00:00:00Z";
    payment.captures = [{ amount: 1000 }];
    order.payment_collections[0].status = "completed";
    project("payment_marked_paid", "paid");
    order.fulfillments = [{ id: "ful_synthetic" }];
    project("fulfillment_started", "processing");
    order.status = "completed";
    project("order_completed", "completed");
    for (const amount of [200, 300, 500]) {
      payment.refunds.push({ amount });
      project("payment_refunded", amount === 500 ? "refunded" : "completed");
    }
    Object.assign(order, unpaid, { status: "canceled" });
    project("order_canceled", "canceled");
    order.payment_collections[0].payments[0].captures = [{ amount: 1000 }];
    order.payment_collections[0].payments[0].refunds = [{ amount: 1000 }];
    project("payment_refunded", "canceled");
  }
}

function stringArray(source: string, name: string): string[] {
  const parsed = ts.createSourceFile("constants.ts", source, ts.ScriptTarget.Latest, true);
  for (const statement of parsed.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name) continue;
      assert.ok(declaration.initializer && ts.isArrayLiteralExpression(declaration.initializer), `${name} must remain a literal array.`);
      return declaration.initializer.elements.map((element) => {
        assert.ok(ts.isStringLiteral(element), `${name} must contain literal fields.`);
        return element.text;
      });
    }
  }
  throw new Error(`Installed Admin field contract ${name} was not found.`);
}
