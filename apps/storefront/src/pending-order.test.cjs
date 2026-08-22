const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = compileTypeScript;

function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
}

const {
  CheckoutClientError,
  createStoreCheckoutClient,
} = require("../lib/checkout.ts");

async function run() {
  verifySourceContract();
  await verifyPendingOrderTransportAndRetryKey();
  await verifySanitizedPendingOrderError();

  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "pending-order",
        status: "ok",
        assertions: [
          "pending-order handoff is available only after the authenticated-ready FT-006 continuation",
          "validated checkout sends only an opaque cart reference and fresh Idempotency-Key",
          "same key can be reused for a same-order retry without client-authoritative totals",
          "pending-order errors are reduced to stable sanitized client messages",
          "the browser handoff does not claim payment success or call a provider",
        ],
      },
      null,
      2
    )}\n`
  );
}

function verifySourceContract() {
  const form = read("../components/checkout-form.tsx");
  const client = read("../lib/checkout.ts");

  assert.match(form, /data-checkout-auth-state="authenticated_ready"/);
  assert.match(form, /data-pending-order-state="created"/);
  assert.match(form, /data-pending-order-error="true"/);
  assert.match(form, /Create pending order/);
  assert.match(form, /Retry pending-order handoff/);
  assert.match(form, /catch \(error\) \{[\s\S]*setPendingOrder\(null\)/);
  assert.match(form, /readCartReference/);
  assert.match(form, /randomUUID/);
  assert.match(client, /\/store\/checkout\/order/);
  assert.match(client, /Idempotency-Key/);
  assert.match(client, /cart_id/);

  for (const forbidden of [
    "paymentProvider",
    "providerSecret",
    "yookassa",
    "stripe",
    "customer_id",
    "unit_price",
    "line_items",
    "tariff_amount",
  ]) {
    assert.equal(form.includes(forbidden), false, `form contains ${forbidden}`);
    assert.equal(client.includes(forbidden), false, `client contains ${forbidden}`);
  }
}

async function verifyPendingOrderTransportAndRetryKey() {
  const calls = [];
  const client = createStoreCheckoutClient({
    baseUrl: "http://backend.test/",
    publishableApiKey: "pk_test_pending",
    fetchImplementation: async (url, init) => {
      calls.push({ url: String(url), init });
      if (new URL(String(url)).pathname === "/store/checkout") {
        return jsonResponse({
          snapshot: {
            name: "Synthetic Buyer",
            email: "buyer@example.test",
            phone: "+7 000",
            city: "Moscow",
            delivery_method: "pickup",
            tariff: { amount: 0, currency_code: "RUB" },
          },
          payment_id: "card",
        });
      }
      return jsonResponse({
        order_id: "order_synthetic",
        status: "pending_payment",
        expires_at: "2026-08-23T12:00:00.000Z",
        payment_id: "card",
      }, 201);
    },
  });

  await client.validate({
    name: "Synthetic Buyer",
    email: "buyer@example.test",
    phone: "+7 000",
    city: "Moscow",
    delivery_method: "pickup",
    payment_method: "card",
  });
  const createPendingOrder = client.createPendingOrder;
  assert.equal(typeof createPendingOrder, "function");
  const first = await createPendingOrder(
    {
      name: "Synthetic Buyer",
      email: "buyer@example.test",
      phone: "+7 000",
      city: "Moscow",
      delivery_method: "pickup",
      payment_method: "card",
    },
    "cart_synthetic",
    "task052-same-key"
  );
  const replay = await createPendingOrder(
    {
      name: "Synthetic Buyer",
      email: "buyer@example.test",
      phone: "+7 000",
      city: "Moscow",
      delivery_method: "pickup",
      payment_method: "card",
    },
    "cart_synthetic",
    "task052-same-key"
  );

  assert.equal(first.order_id, "order_synthetic");
  assert.equal(replay.order_id, first.order_id);
  const pendingCalls = calls.filter((call) =>
    new URL(call.url).pathname.endsWith("/checkout/order")
  );
  assert.equal(pendingCalls.length, 2);
  assert.deepEqual(
    pendingCalls.map((call) => call.init.headers["Idempotency-Key"]),
    ["task052-same-key", "task052-same-key"]
  );
  assert.deepEqual(JSON.parse(pendingCalls[0].init.body), {
    cart_id: "cart_synthetic",
    name: "Synthetic Buyer",
    email: "buyer@example.test",
    phone: "+7 000",
    city: "Moscow",
    delivery_method: "pickup",
    payment_method: "card",
  });
}

async function verifySanitizedPendingOrderError() {
  const client = createStoreCheckoutClient({
    publishableApiKey: "pk_test_pending",
    fetchImplementation: async () =>
      jsonResponse(
        {
          error: {
            code: "checkout_stock_conflict",
            message: "raw customer@example.test inventory-secret",
            details: { raw: "forbidden" },
          },
        },
        409
      ),
  });

  await assert.rejects(
    () =>
      client.createPendingOrder(
        {
          name: "Buyer",
          email: "buyer@example.test",
          phone: "7000",
          city: "Moscow",
          delivery_method: "pickup",
          payment_method: "card",
        },
        "cart_synthetic",
        "task052-stock-conflict"
      ),
    (error) =>
      error instanceof CheckoutClientError &&
      error.code === "checkout_stock_conflict" &&
      error.status === 409 &&
      error.message === "The current inventory cannot satisfy this cart." &&
      !error.message.includes("customer@example.test") &&
      !error.message.includes("secret")
  );
}

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, relativePath), "utf8");
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

module.exports = { run };
