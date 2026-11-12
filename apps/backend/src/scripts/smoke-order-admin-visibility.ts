import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

/**
 * Offline installed-source contract only. This does not load Medusa, query an
 * order, render Admin, or prove runtime authorization/payment/inventory behavior.
 */
export default function smokeOrderAdminVisibilityContract() {
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

  process.stdout.write(`${JSON.stringify({
    suite: "order-admin-visibility-contract",
    status: "ok",
    sourceBoundary: "installed-medusa-admin-source-contract",
    runtimeVerified: false,
    dashboardVersion: dashboardPackage.version,
    checkedFiles,
    checks: ["order-detail-request-fields", "metadata-display-and-editor-wiring", "native-mark-as-paid-order-binding", "native-cancel-hook"],
    deferred: ["real-order-payload", "rendered-admin-fields", "authorization", "protected-metadata-runtime-enforcement", "payment-and-inventory-mutations"],
  }, null, 2)}\n`);
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
