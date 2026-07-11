"use client";

import { type FormEvent, useEffect, useState } from "react";
import { formatCatalogMoney } from "../lib/catalog";
import { readCartReference, type StoreCart, type StoreCartLineItem } from "../lib/cart";
import { type GuestCartState } from "../lib/cart-state";
import { useCart } from "./cart-provider";

type CartLineFormElements = HTMLFormControlsCollection & {
  quantity: HTMLInputElement;
};

type CartLineForm = HTMLFormElement & {
  elements: CartLineFormElements;
};

export function CartView() {
  const { state, restore, updateItem, removeItem, clearLocalReference } = useCart();
  const [restoreAttempted, setRestoreAttempted] = useState(false);
  const [staleReferenceCleared, setStaleReferenceCleared] = useState(false);
  const cart = state.cart;
  const items = cart?.items ?? [];
  const busy = state.status === "loading";

  async function restoreCart() {
    const hadReference = hasStoredReference();
    const restored = await restore();
    setRestoreAttempted(true);
    setStaleReferenceCleared(
      hadReference &&
        restored.status === "empty" &&
        restored.cart === null &&
        restored.error === null
    );
    return restored;
  }

  useEffect(() => {
    void restoreCart();
    // Restore is intentionally owned by the cart page so stale reference
    // recovery can be rendered as a visible state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitQuantity(
    event: FormEvent<HTMLFormElement>,
    lineItemId: string
  ) {
    event.preventDefault();
    const form = event.currentTarget as CartLineForm;
    const quantity = Number(form.elements.quantity.value);
    setStaleReferenceCleared(false);
    await updateItem({ lineItemId, quantity });
  }

  async function removeLineItem(lineItemId: string) {
    setStaleReferenceCleared(false);
    await removeItem({ lineItemId });
  }

  function clearReference() {
    setStaleReferenceCleared(false);
    clearLocalReference();
    setRestoreAttempted(true);
  }

  return (
    <main className="catalogShell" data-cart-view-state={state.status}>
      <header className="catalogHeader">
        <div>
          <p className="eyebrow">Guest cart</p>
          <h1>Cart</h1>
        </div>
        <a className="productDetailLink" href="/">
          Continue shopping
        </a>
      </header>

      <CartStateMessage
        state={state}
        restoreAttempted={restoreAttempted}
        staleReferenceCleared={staleReferenceCleared}
        onRetry={restoreCart}
        onClear={clearReference}
      />

      {cart ? (
        <section aria-label="Cart contents">
          <div className="selectedState">
            <div>
              <h2>Backend cart</h2>
              <p data-cart-id={cart.id}>{cart.id}</p>
            </div>
            <p data-cart-total-source="backend">{formatCartTotal(cart)}</p>
            <button
              className="addToCartButton"
              type="button"
              disabled={busy}
              onClick={() => void restoreCart()}
            >
              Refresh cart
            </button>
          </div>

          {items.length > 0 ? (
            <div className="productGrid" data-cart-items-source="backend">
              {items.map((item) => (
                <article
                  className="productCard"
                  key={item.id}
                  data-cart-line-id={item.id}
                  data-cart-line-variant-id={item.variant_id}
                >
                  <div className="productVisual" aria-hidden="true">
                    <span>{item.variant_id}</span>
                  </div>
                  <div className="productBody">
                    <p className="productCategory">{cartLineVariant(item)}</p>
                    <h2>{cartLineTitle(item)}</h2>
                    <p>Quantity from backend: {item.quantity}</p>
                    <p>{cartLineMoney(item, cart.currency_code)}</p>
                    <form
                      className="cartAction"
                      data-cart-update-mode="absolute"
                      onSubmit={(event) => submitQuantity(event, item.id)}
                    >
                      <label className="field">
                        <span>Quantity</span>
                        <input
                          name="quantity"
                          type="number"
                          min="1"
                          step="1"
                          defaultValue={item.quantity}
                          disabled={busy}
                        />
                      </label>
                      <button className="addToCartButton" type="submit" disabled={busy}>
                        Update
                      </button>
                    </form>
                    <button
                      className="productDetailLink"
                      type="button"
                      disabled={busy}
                      onClick={() => void removeLineItem(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <section className="catalogState" role="status" data-cart-empty-source="backend">
              <h2>Cart is empty</h2>
              <p>The backend cart has no line items.</p>
            </section>
          )}
        </section>
      ) : null}
    </main>
  );
}

function CartStateMessage({
  state,
  restoreAttempted,
  staleReferenceCleared,
  onRetry,
  onClear,
}: {
  state: GuestCartState;
  restoreAttempted: boolean;
  staleReferenceCleared: boolean;
  onRetry(): Promise<GuestCartState>;
  onClear(): void;
}) {
  if (state.status === "loading" || (!restoreAttempted && state.status === "idle")) {
    return (
      <section className="catalogState" role="status" data-cart-loading="true">
        <h2>Loading cart</h2>
        <p>Cart contents are being read from the backend.</p>
      </section>
    );
  }

  if (staleReferenceCleared) {
    return (
      <section
        className="catalogState"
        role="status"
        data-cart-stale-reference="cleared"
      >
        <h2>Saved cart expired</h2>
        <p>The local cart reference was stale and has been cleared.</p>
        <button className="addToCartButton" type="button" onClick={() => void onRetry()}>
          Retry
        </button>
      </section>
    );
  }

  if (state.status === "empty" && !state.cart) {
    return (
      <section className="catalogState" role="status" data-cart-empty="true">
        <h2>Cart is empty</h2>
        <p>Add a valid product variant to create a backend cart.</p>
      </section>
    );
  }

  if (state.status === "validation_error") {
    return (
      <section className="catalogState" role="status" data-cart-validation="true">
        <h2>Quantity needs attention</h2>
        <p>{state.error?.message || "Use a positive whole quantity."}</p>
      </section>
    );
  }

  if (state.status === "stock_conflict") {
    return (
      <section className="catalogState" role="status" data-cart-conflict="stock">
        <h2>Cart could not be updated</h2>
        <p>Backend validation rejected this cart change. Adjust quantity and retry.</p>
      </section>
    );
  }

  if (state.status === "backend_error") {
    return (
      <section className="catalogState" role="status" data-cart-failure="backend">
        <h2>Cart service unavailable</h2>
        <p>{state.error?.message || "Try again later."}</p>
        <div className="filterActions">
          <button className="addToCartButton" type="button" onClick={() => void onRetry()}>
            Retry
          </button>
          <button className="productDetailLink" type="button" onClick={onClear}>
            Clear local reference
          </button>
        </div>
      </section>
    );
  }

  return null;
}

export function formatCartTotal(cart: StoreCart) {
  return typeof cart.total === "number"
    ? `Total: ${formatBackendMoney(cart.total, cart.currency_code)}`
    : "Total unavailable from backend";
}

export function cartLineTitle(item: StoreCartLineItem) {
  return readString(item, "title") || readString(item, "product_title") || item.variant_id;
}

export function cartLineVariant(item: StoreCartLineItem) {
  return readString(item, "variant_sku") || readString(item, "sku") || item.variant_id;
}

export function cartLineMoney(item: StoreCartLineItem, currencyCode?: string) {
  const total = readNumber(item, "total");
  if (total !== null) {
    return `Line total from backend: ${formatBackendMoney(total, currencyCode)}`;
  }

  const unitPrice = readNumber(item, "unit_price");
  if (unitPrice !== null) {
    return `Unit price from backend: ${formatBackendMoney(unitPrice, currencyCode)}`;
  }

  return "Line price unavailable from backend";
}

function formatBackendMoney(amount: number, currencyCode?: string) {
  return currencyCode ? formatCatalogMoney(amount, currencyCode) : String(amount);
}

function readString(item: StoreCartLineItem, key: string) {
  const value = item[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(item: StoreCartLineItem, key: string) {
  const value = item[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function hasStoredReference() {
  try {
    return readCartReference() !== null;
  } catch {
    return false;
  }
}
