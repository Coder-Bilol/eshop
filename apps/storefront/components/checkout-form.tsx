"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { formatCatalogMoney } from "../lib/catalog";
import {
  createStoreCheckoutClient,
  DELIVERY_METHOD_IDS,
  DELIVERY_METHOD_LABELS,
  PAYMENT_METHOD_IDS,
  PAYMENT_METHOD_LABELS,
  type CheckoutField,
  type DeliveryMethodId,
  type StoreCheckoutClient,
} from "../lib/checkout";
import {
  createCheckoutStateController,
  type CheckoutState,
  type CheckoutStateController,
} from "../lib/checkout-state";

export type CheckoutFormProps = {
  client?: StoreCheckoutClient;
};

export function AuthenticatedCheckoutContinuation(props: CheckoutFormProps) {
  const [gateReady, setGateReady] = useState(false);

  useEffect(() => {
    const syncWithExistingGate = () => {
      setGateReady(
        document.querySelector(
          '[data-checkout-auth-state="authenticated_ready"]'
        ) !== null
      );
    };

    syncWithExistingGate();
    const observer = new MutationObserver(syncWithExistingGate);
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-checkout-auth-state"],
    });
    return () => observer.disconnect();
  }, []);

  return gateReady ? <CheckoutForm {...props} /> : null;
}

export function CheckoutForm({ client }: CheckoutFormProps) {
  const controller = useMemo<CheckoutStateController>(
    () =>
      createCheckoutStateController({
        client: client ?? createStoreCheckoutClient(),
      }),
    [client]
  );
  const [state, setState] = useState<CheckoutState>(() => controller.getState());

  useEffect(() => controller.subscribe(setState), [controller]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void controller.submit();
  }

  const busy = state.status === "checkout_validating";
  const addressRequired = state.values.delivery_method !== "pickup";

  return (
    <section className="catalogMain" data-checkout-form="ft-006" data-checkout-state={state.status}>
      <header className="catalogHeader">
        <div>
          <p className="eyebrow">Delivery and payment</p>
          <h2>Checkout details</h2>
        </div>
        <p>Details are validated before the next checkout step.</p>
      </header>

      <CheckoutStateMessage state={state} onRetry={() => void controller.retry()} />

      <form noValidate onSubmit={submit}>
        <section className="catalogFilters" aria-label="Contact details">
          <CheckoutTextField
            field="name"
            label="Name"
            value={state.values.name}
            error={state.error?.fields.name}
            disabled={busy}
            onChange={(value) => controller.setField("name", value)}
          />
          <CheckoutTextField
            field="email"
            label="Email"
            type="email"
            value={state.values.email}
            error={state.error?.fields.email}
            disabled={busy}
            onChange={(value) => controller.setField("email", value)}
          />
          <CheckoutTextField
            field="phone"
            label="Phone"
            type="tel"
            value={state.values.phone}
            error={state.error?.fields.phone}
            disabled={busy}
            onChange={(value) => controller.setField("phone", value)}
          />
          <CheckoutTextField
            field="city"
            label="City"
            value={state.values.city}
            error={state.error?.fields.city}
            disabled={busy}
            onChange={(value) => controller.setField("city", value)}
          />
          {addressRequired ? (
            <CheckoutTextField
              field="address"
              label="Address"
              value={state.values.address}
              error={state.error?.fields.address}
              disabled={busy}
              required={addressRequired}
              onChange={(value) => controller.setField("address", value)}
            />
          ) : null}
          <label className="field">
            <span>Comment (optional)</span>
            <textarea
              name="comment"
              value={state.values.comment}
              disabled={busy}
              onChange={(event) => controller.setField("comment", event.currentTarget.value)}
            />
          </label>
        </section>

        <fieldset className="catalogFilters" disabled={busy}>
          <legend>Delivery method</legend>
          <p data-tariff-source="backend">
            Delivery tariffs are confirmed by the backend for the selected method.
          </p>
          <div className="optionValues">
            {DELIVERY_METHOD_IDS.map((method) => {
              const tariff = state.tariffs[method];
              return (
                <label className="optionValue" key={method} data-delivery-option={method}>
                  <input
                    type="radio"
                    name="delivery_method"
                    value={method}
                    checked={state.values.delivery_method === method}
                    onChange={() => controller.selectDeliveryMethod(method)}
                  />
                  <span>{DELIVERY_METHOD_LABELS[method]}</span>
                  <strong data-tariff-source="backend">
                    {tariff
                      ? formatCatalogMoney(tariff.amount, tariff.currency_code)
                      : "Tariff confirmed when validated"}
                  </strong>
                </label>
              );
            })}
          </div>
          {state.error?.fields.delivery_method ? (
            <p role="alert">Select a supported delivery method.</p>
          ) : null}
        </fieldset>

        <fieldset className="catalogFilters" disabled={busy}>
          <legend>Payment method</legend>
          <div className="optionValues">
            {PAYMENT_METHOD_IDS.map((method) => (
              <label className="optionValue" key={method} data-payment-option={method}>
                <input
                  type="radio"
                  name="payment_method"
                  value={method}
                  checked={state.values.payment_method === method}
                  onChange={() => controller.selectPaymentMethod(method)}
                />
                <span>{PAYMENT_METHOD_LABELS[method]}</span>
              </label>
            ))}
          </div>
          {state.error?.fields.payment_method ? (
            <p role="alert">Select a supported payment method.</p>
          ) : null}
        </fieldset>

        <div className="filterActions">
          <button className="addToCartButton" type="submit" disabled={busy}>
            {busy ? "Validating..." : "Validate checkout details"}
          </button>
        </div>
      </form>
    </section>
  );
}

function CheckoutStateMessage({
  state,
  onRetry,
}: {
  state: CheckoutState;
  onRetry(): void;
}) {
  if (state.status === "checkout_validated" && state.handoff) {
    return (
      <section className="selectionState selectionState-valid" role="status" data-checkout-handoff="validated">
        <strong>Checkout details validated</strong>
        <p>
          The details are ready for the next checkout handoff. No order or payment
          has been created by this step.
        </p>
      </section>
    );
  }

  if (state.status === "checkout_invalid") {
    return (
      <section className="handoffFailure" role="alert" data-checkout-error="validation">
        <strong>Some details need attention</strong>
        <p>{state.error?.message}</p>
      </section>
    );
  }

  if (state.status === "delivery_method_unavailable") {
    const method = state.error?.deliveryMethod;
    return (
      <section className="handoffFailure" role="alert" data-checkout-error="unavailable">
        <strong>Delivery method unavailable</strong>
        <p>{state.error?.message}</p>
        {method ? <p>Selected method: {methodLabel(method)}</p> : null}
        <div className="filterActions" data-checkout-recovery="alternative">
          <button className="addToCartButton" type="button" onClick={onRetry}>
            Retry selected method
          </button>
          <span>Or choose another delivery method below.</span>
        </div>
      </section>
    );
  }

  if (state.status === "checkout_failed") {
    return (
      <section className="handoffFailure" role="alert" data-checkout-error="failed">
        <strong>Checkout could not be validated</strong>
        <p>{state.error?.message}</p>
        <button className="addToCartButton" type="button" onClick={onRetry}>
          Retry validation
        </button>
      </section>
    );
  }

  return null;
}

function CheckoutTextField({
  field,
  label,
  type = "text",
  value,
  error,
  disabled,
  required = true,
  onChange,
}: {
  field: Extract<CheckoutField, "name" | "email" | "phone" | "city" | "address">;
  label: string;
  type?: string;
  value: string;
  error?: string;
  disabled: boolean;
  required?: boolean;
  onChange(value: string): void;
}) {
  const errorId = `${field}-error`;
  return (
    <label className="field">
      <span>{label}</span>
      <input
        name={field}
        type={type}
        value={value}
        required={required}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      {error ? <small id={errorId}>{fieldErrorMessage(error)}</small> : null}
    </label>
  );
}

function fieldErrorMessage(reason: string) {
  switch (reason) {
    case "required":
      return "This field is required.";
    case "invalid":
      return "Enter a valid value.";
    case "too_long":
      return "This value is too long.";
    default:
      return "Check this field.";
  }
}

function methodLabel(method: DeliveryMethodId) {
  return DELIVERY_METHOD_LABELS[method];
}
