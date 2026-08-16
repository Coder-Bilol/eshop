const assert = require("node:assert/strict");
const fs = require("node:fs");
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
  createInitialCheckoutValues,
} = require("../lib/checkout.ts");
const {
  createCheckoutStateController,
  validateCheckoutForm,
} = require("../lib/checkout-state.ts");

async function run() {
  verifyLocalValidationAndNormalization();
  await verifyValidatedHandoffUsesBackendTariff();
  await verifyUnavailableRecoveryAndExplicitAlternative();
  await verifyUnexpectedFailureIsSanitized();

  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "checkout-state",
        status: "ok",
        assertions: [
          "required fields and conditional address validation are deterministic",
          "client normalization precedes the backend checkout call without making the UI authoritative",
          "validated state stores the backend tariff and selected payment handoff only",
          "unavailable delivery preserves the selected method until retry or explicit alternative selection",
          "unexpected client failures render safe messages without backend detail leakage",
          "checkout state has no order, payment-provider, or browser-storage transition",
        ],
      },
      null,
      2
    )}\n`
  );
}

function verifyLocalValidationAndNormalization() {
  const values = {
    ...createInitialCheckoutValues(),
    name: "  Synthetic   Buyer ",
    email: "  BUYER@EXAMPLE.TEST ",
    phone: " +7 000 ",
    city: "  Moscow  ",
    delivery_method: "city_courier",
    payment_method: "sbp",
  };
  const missingAddress = validateCheckoutForm(values);
  assert.equal(missingAddress.ok, false);
  assert.deepEqual(missingAddress.fields, { address: "required" });

  const valid = validateCheckoutForm({
    ...values,
    address: "  Synthetic   street 1 ",
    comment: " note   for   courier ",
  });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.input, {
    name: "Synthetic Buyer",
    email: "buyer@example.test",
    phone: "+7 000",
    city: "Moscow",
    address: "Synthetic street 1",
    comment: "note for courier",
    delivery_method: "city_courier",
    payment_method: "sbp",
  });

  const pickup = validateCheckoutForm({
    ...createInitialCheckoutValues(),
    name: "Buyer",
    email: "buyer@example.test",
    phone: "7000",
    city: "Moscow",
    delivery_method: "pickup",
    payment_method: "card",
  });
  assert.equal(pickup.ok, true);
  assert.equal("address" in pickup.input, false);
}

async function verifyValidatedHandoffUsesBackendTariff() {
  const calls = [];
  const controller = createCheckoutStateController({
    client: {
      async validate(input) {
        calls.push(input);
        return {
          snapshot: {
            name: input.name,
            email: input.email,
            phone: input.phone,
            city: input.city,
            address: input.address,
            comment: input.comment,
            delivery_method: input.delivery_method,
            tariff: { amount: 50000, currency_code: "RUB" },
          },
          payment_id: input.payment_method,
        };
      },
    },
  });

  fillValidFields(controller);
  const state = await controller.submit();
  assert.equal(state.status, "checkout_validated");
  assert.equal(state.handoff.payment_id, "sbp");
  assert.deepEqual(state.tariffs.city_courier, {
    amount: 50000,
    currency_code: "RUB",
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "Synthetic Buyer");
  assert.equal(calls[0].email, "buyer@example.test");
  assert.equal(calls[0].tariff, undefined);
  assert.equal(calls[0].customer_id, undefined);
  assert.equal(calls[0].address, "Synthetic address");
}

async function verifyUnavailableRecoveryAndExplicitAlternative() {
  let calls = 0;
  const controller = createCheckoutStateController({
    client: {
      async validate(input) {
        calls += 1;
        if (calls === 1) {
          throw new CheckoutClientError(
            "delivery_method_unavailable",
            "backend detail must not render",
            422,
            { delivery_method: input.delivery_method }
          );
        }
        return successfulResult(input, 0);
      },
    },
  });

  fillValidFields(controller);
  controller.selectDeliveryMethod("transport_company");
  controller.setField("address", "Synthetic transport address");
  let state = await controller.submit();
  assert.equal(state.status, "delivery_method_unavailable");
  assert.equal(state.values.delivery_method, "transport_company");
  assert.equal(state.error.deliveryMethod, "transport_company");
  assert.equal(state.error.message.includes("backend detail"), false);

  controller.selectDeliveryMethod("pickup");
  state = controller.getState();
  assert.equal(state.status, "checkout_editing");
  assert.equal(state.values.delivery_method, "pickup");
  assert.equal(state.values.address, "");
  state = await controller.retry();
  assert.equal(state.status, "checkout_editing");
  assert.equal(calls, 1);

  state = await controller.submit();
  assert.equal(state.status, "checkout_validated");
  assert.equal(state.handoff.snapshot.delivery_method, "pickup");
  assert.equal(calls, 2);
}

async function verifyUnexpectedFailureIsSanitized() {
  const controller = createCheckoutStateController({
    client: {
      async validate() {
        throw new CheckoutClientError(
          "checkout_failed",
          "raw customer@example.test provider-secret",
          500
        );
      },
    },
  });
  fillValidFields(controller);
  const state = await controller.submit();
  assert.equal(state.status, "checkout_failed");
  assert.equal(state.error.message.includes("customer@example.test"), false);
  assert.equal(state.error.message.includes("provider-secret"), false);
}

function fillValidFields(controller) {
  controller.setField("name", "  Synthetic   Buyer ");
  controller.setField("email", " BUYER@EXAMPLE.TEST ");
  controller.setField("phone", " +7 000 ");
  controller.setField("city", " Moscow ");
  controller.selectDeliveryMethod("city_courier");
  controller.setField("address", " Synthetic address ");
  controller.setField("comment", " optional note ");
  controller.selectPaymentMethod("sbp");
}

function successfulResult(input, amount) {
  return {
    snapshot: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      city: input.city,
      ...(input.address ? { address: input.address } : {}),
      ...(input.comment ? { comment: input.comment } : {}),
      delivery_method: input.delivery_method,
      tariff: { amount, currency_code: "RUB" },
    },
    payment_id: input.payment_method,
  };
}

module.exports = { run };
