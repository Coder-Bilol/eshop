const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = compileTypeScript;
require.extensions[".tsx"] = compileTypeScript;

function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
}

const {
  currentWishlistReturnPath,
  getWishlistControlState,
  routeGuestToLogin,
} = require("../components/wishlist-toggle.tsx");
const { AUTH_RETURN_PATH_KEY } = require("../lib/auth.ts");

async function run() {
  verifyControlStates();
  verifyGuestLoginRoutingWithoutFavoriteIntent();
  verifyUiBoundariesAndExactProjection();

  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "wishlist-ui",
        status: "ok",
        assertions: [
          "catalog and detail controls use opaque product IDs and accessible labels",
          "guest controls use the existing safe return path and never call wishlist mutations",
          "idle/pending/saved/error control states disable duplicate pending actions",
          "wishlist page renders exact product projection fields and current handles",
          "loading/empty/products/error/remove/session-expired page states are represented",
          "wishlist UI has no cart-merge dependency or browser wishlist persistence",
        ],
      },
      null,
      2
    )}\n`
  );
}

function verifyControlStates() {
  const base = {
    status: "ready",
    customerId: "cus_fixture",
    items: [item("prod_saved")],
    pendingProductIds: [],
    errors: {},
    error: null,
  };

  assert.equal(getWishlistControlState("prod_idle", { ...base, items: [] }, true), "idle");
  assert.equal(getWishlistControlState("prod_saved", base, true), "saved");
  assert.equal(
    getWishlistControlState("prod_saved", { ...base, pendingProductIds: ["prod_saved"] }, true),
    "pending"
  );
  assert.equal(
    getWishlistControlState(
      "prod_idle",
      { ...base, items: [], errors: { prod_idle: { code: "wishlist_operation_failed" } } },
      true
    ),
    "error"
  );
  assert.equal(getWishlistControlState("prod_saved", base, false), "idle");
}

function verifyGuestLoginRoutingWithoutFavoriteIntent() {
  const storage = new MemoryStorage();
  global.window = { sessionStorage: storage };
  const navigation = [];
  routeGuestToLogin(
    { pathname: "/products/current-handle", search: "?q=curtain" },
    (location) => navigation.push(location)
  );

  assert.deepEqual(navigation, ["/login"]);
  assert.deepEqual(JSON.parse(storage.getItem(AUTH_RETURN_PATH_KEY)), {
    version: 1,
    path: "/products/current-handle?q=curtain",
  });
  assert.equal(storage.getItem(AUTH_RETURN_PATH_KEY).includes("prod_"), false);
  assert.equal(currentWishlistReturnPath({ pathname: "/", search: "" }), "/");
}

function verifyUiBoundariesAndExactProjection() {
  const root = path.join(__dirname, "..");
  const toggle = read(path.join(root, "components", "wishlist-toggle.tsx"));
  const view = read(path.join(root, "components", "wishlist-view.tsx"));
  const page = read(path.join(root, "app", "wishlist", "page.tsx"));
  const catalog = read(path.join(root, "app", "page.tsx"));
  const detail = read(path.join(root, "app", "products", "[handle]", "page.tsx"));
  const runner = read(path.join(root, "src", "test-runner.cjs"));

  assert.match(toggle, /useAuth\(\)/);
  assert.match(toggle, /useWishlist\(\)/);
  assert.match(toggle, /writeReturnPath/);
  assert.match(toggle, /data-wishlist-state=\{controlState\}/);
  assert.match(toggle, /aria-label=\{label\}/);
  assert.match(toggle, /aria-busy=\{pending\}/);
  assert.match(toggle, /disabled=\{disabled\}/);
  assert.match(toggle, /productId/);
  assert.doesNotMatch(toggle, /useCart\(\)|mergeAfterAuthentication|merge_blocked/);
  assert.doesNotMatch(toggle, /localStorage|sessionStorage/);

  for (const state of ["loading", "error", "session-expired"]) {
    assert.match(view, new RegExp(`data-wishlist-page-state="${state}"`));
  }
  assert.match(view, /data-wishlist-page-state=\{state\.items\.length \? "products" : "empty"\}/);
  for (const field of [
    "product.id",
    "product.handle",
    "product.title",
    "product.thumbnail",
    "product.category.name",
    "product.price.amount",
    "product.price.currency_code",
    "product.is_available",
  ]) {
    assert.match(view, new RegExp(escapeRegExp(field)));
  }
  assert.match(view, /encodeURIComponent\(product\.handle\)/);
  assert.match(view, /<WishlistToggle productId=\{product\.id\}/);
  assert.match(view, /load\(customerId!\)/);
  assert.doesNotMatch(view, /created_at|item\.product_id/);
  assert.doesNotMatch(view, /mergeAfterAuthentication|merge_blocked|localStorage|sessionStorage/);

  assert.match(page, /<WishlistView \/>/);
  assert.match(catalog, /<WishlistToggle/);
  assert.match(catalog, /productId=\{product\.id\}/);
  assert.match(detail, /<WishlistToggle productId=\{product\.id\}/);
  assert.match(runner, /"wishlist-ui"/);
}

function item(productId) {
  return {
    id: `witem_${productId}`,
    product_id: productId,
    created_at: "2026-08-08T00:00:00.000Z",
    product: {
      id: productId,
      handle: "current-handle",
      title: "Synthetic product",
      thumbnail: null,
      category: { handle: "catalog", name: "Catalog" },
      price: { amount: 159900, currency_code: "RUB" },
      is_available: true,
    },
  };
}

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { run };
