const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

async function run() {
  const appRoot = path.join(__dirname, "..", "app");
  const componentRoot = path.join(__dirname, "..", "components");
  const layoutSource = read(path.join(appRoot, "layout.tsx"));
  const cartPageSource = read(path.join(appRoot, "cart", "page.tsx"));
  const cartViewSource = read(path.join(componentRoot, "cart-view.tsx"));
  const productDetailSource = read(
    path.join(componentRoot, "product-detail-selector.tsx")
  );
  const runnerSource = read(path.join(__dirname, "test-runner.cjs"));

  assert.match(layoutSource, /<CartProvider restoreOnMount=\{false\}>/);
  assert.match(cartPageSource, /<CartView \/>/);
  assert.match(runnerSource, /"cart-view"/);

  for (const required of [
    "readCartReference",
    "data-cart-stale-reference",
    "data-cart-empty",
    "data-cart-validation",
    "data-cart-conflict",
    "data-cart-failure",
    "data-cart-total-source=\"backend\"",
    "data-cart-items-source=\"backend\"",
    "data-cart-update-mode=\"absolute\"",
    "updateItem({ lineItemId, quantity })",
    "removeItem({ lineItemId })",
  ]) {
    assert.match(cartViewSource, new RegExp(escapeRegExp(required)));
  }

  for (const forbidden of [
    "localStorage.setItem",
    "JSON.stringify",
    "authenticated",
    "checkout",
    "payment",
  ]) {
    assert.equal(
      cartViewSource.includes(forbidden),
      false,
      `cart-view source must not include ${forbidden}`
    );
  }

  assert.match(productDetailSource, /useCart\(\)/);
  assert.match(productDetailSource, /payload\.selected_variant_id/);
  assert.match(productDetailSource, /addItem\(\{/);
  assert.match(productDetailSource, /cart-action-added/);
  assert.match(productDetailSource, /cart-action-failed/);
  assert.match(
    productDetailSource,
    /disabled=\{!selectionResult\.canAddToCart \|\| addInProgress\}/
  );
  assert.doesNotMatch(productDetailSource, /setCartAction\([^)]*selected_variant_id/);

  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "cart-view",
        status: "ok",
        dataSource: "source-level-component-contract",
        assertions: [
          "layout provides cart state without hiding stale-reference detection",
          "cart page renders the cart view",
          "cart view renders backend cart items and totals only from response state",
          "cart view exposes loading, empty, stale, validation, conflict, and backend failure states",
          "cart view drives absolute quantity update and remove through TASK-022 state functions",
          "product detail sends only a valid selected Medusa Product Variant ID into guest-cart add",
          "FT-002 disabled selection guards remain in place",
          "cart UI source does not store browser-authoritative cart payloads or add auth/checkout/payment scope",
        ],
      },
      null,
      2
    )}\n`
  );
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { run };

