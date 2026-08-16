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
  await verifyAuthenticatedBackendClient();
  await verifyStableSanitizedErrors();

  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "checkout-form",
        status: "ok",
        assertions: [
          "form is isolated behind the existing authenticated_ready gate",
          "all contract fields and stable delivery/payment selections are rendered",
          "backend-resolved tariff data is displayed without client tariff constants",
          "authenticated POST uses the existing Store boundary and credentials include",
          "backend error details are reduced to stable sanitized client errors",
          "validated handoff explicitly does not claim order or payment success",
        ],
      },
      null,
      2
    )}\n`
  );
}

function verifySourceContract() {
  const page = read("../app/checkout/page.tsx");
  const form = read("../components/checkout-form.tsx");
  const state = read("../lib/checkout-state.ts");
  const client = read("../lib/checkout.ts");
  const runner = read("./test-runner.cjs");

  assert.match(page, /<CheckoutAuthGate \/>/);
  assert.match(page, /<AuthenticatedCheckoutContinuation \/>/);
  assert.match(form, /data-checkout-auth-state="authenticated_ready"/);
  assert.match(form, /data-checkout-form="ft-006"/);
  assert.match(form, /field="name"/);
  assert.match(form, /field="email"/);
  assert.match(form, /field="phone"/);
  assert.match(form, /field="city"/);
  assert.match(form, /field="address"/);
  assert.match(form, /name=\"comment\"/);
  assert.match(form, /data-delivery-option={method}/);
  assert.match(form, /data-payment-option={method}/);
  assert.match(form, /data-tariff-source="backend"/);
  assert.match(form, /data-checkout-recovery="alternative"/);
  assert.match(form, /data-checkout-handoff="validated"/);
  assert.match(form, /No order or payment\s+has been created/);
  assert.match(state, /"delivery_method_unavailable"/);
  assert.match(state, /safeErrorMessage/);
  assert.match(client, /POST/);
  assert.match(client, /credentials: "include"/);
  assert.match(client, /x-publishable-api-key/);
  assert.match(client, /delivery_method_unavailable/);
  assert.match(runner, /"checkout-form"/);
  assert.match(runner, /"checkout-state"/);

  for (const forbidden of [
    "localStorage",
    "sessionStorage",
    "createOrder",
    "startPayment",
    "paymentProvider",
    "providerSecret",
    "customer_id",
    "0 RUB",
    "500 RUB",
    "700 RUB",
  ]) {
    assert.equal(form.includes(forbidden), false, `form contains ${forbidden}`);
    assert.equal(client.includes(forbidden), false, `client contains ${forbidden}`);
    assert.equal(state.includes(forbidden), false, `state contains ${forbidden}`);
  }
}

async function verifyAuthenticatedBackendClient() {
  const calls = [];
  const client = createStoreCheckoutClient({
    baseUrl: "http://backend.test/",
    publishableApiKey: "pk_test_checkout",
    fetchImplementation: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({
        snapshot: {
          name: "Synthetic Buyer",
          email: "buyer@example.test",
          phone: "+7 000",
          city: "Moscow",
          delivery_method: "city_courier",
          tariff: { amount: 50000, currency_code: "RUB" },
        },
        payment_id: "sbp",
      });
    },
  });

  const result = await client.validate({
    name: "  Synthetic   Buyer ",
    email: " BUYER@EXAMPLE.TEST ",
    phone: " +7 000 ",
    city: " Moscow ",
    address: " Synthetic address ",
    comment: " note ",
    delivery_method: "city_courier",
    payment_method: "sbp",
  });
  assert.equal(result.payment_id, "sbp");
  assert.equal(result.snapshot.tariff.amount, 50000);
  assert.deepEqual(calls.map((call) => [call.init.method, new URL(call.url).pathname]), [
    ["POST", "/store/checkout"],
  ]);
  assert.equal(calls[0].init.credentials, "include");
  assert.equal(calls[0].init.cache, "no-store");
  assert.equal(calls[0].init.headers["x-publishable-api-key"], "pk_test_checkout");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    name: "Synthetic Buyer",
    email: "buyer@example.test",
    phone: "+7 000",
    city: "Moscow",
    address: "Synthetic address",
    comment: "note",
    delivery_method: "city_courier",
    payment_method: "sbp",
  });
}

async function verifyStableSanitizedErrors() {
  const client = createStoreCheckoutClient({
    publishableApiKey: "pk_test_checkout",
    fetchImplementation: async () =>
      jsonResponse(
        {
          error: {
            code: "delivery_method_unavailable",
            message: "raw customer@example.test secret",
            details: { delivery_method: "transport_company", raw: "forbidden" },
          },
        },
        422
      ),
  });
  await assert.rejects(
    () =>
      client.validate({
        name: "Buyer",
        email: "buyer@example.test",
        phone: "7000",
        city: "Moscow",
        delivery_method: "transport_company",
        payment_method: "card",
        address: "Synthetic address",
      }),
    (error) =>
      error instanceof CheckoutClientError &&
      error.code === "delivery_method_unavailable" &&
      error.status === 422 &&
      error.details.delivery_method === "transport_company" &&
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
