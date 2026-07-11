"use client";

import { useMemo, useState } from "react";
import { useCart } from "./cart-provider";
import { formatCatalogMoney, formatCatalogValue } from "../lib/catalog";
import {
  buildCartActionHandoff,
  resolveVariantSelection,
  type ProductDetail,
  type VariantSelectionResult,
} from "../lib/product-detail";

type Selection = Record<string, string>;
type CartActionState =
  | {
      status: "added";
      variantSku: string;
      cartId: string;
      quantity: number;
    }
  | {
      status: "failed";
      variantSku: string;
      reason: string;
    };

export function ProductDetailSelector({ product }: { product: ProductDetail }) {
  const [selection, setSelection] = useState<Selection>({});
  const [cartAction, setCartAction] = useState<CartActionState | null>(null);
  const { state: cartState, addItem } = useCart();
  const selectionResult = useMemo(
    () => resolveVariantSelection(product, selection),
    [product, selection]
  );

  function selectOption(name: string, value: string) {
    setSelection((current) => ({
      ...current,
      [name]: value,
    }));
    setCartAction(null);
  }

  async function submitSelection() {
    const payload = buildCartActionHandoff(product.handle, selectionResult);
    if (payload) {
      const nextState = await addItem({
        variantId: payload.selected_variant_id,
        quantity: payload.quantity,
      });

      if (nextState.status === "ready" && nextState.cart) {
        setCartAction({
          status: "added",
          variantSku: payload.selected_variant_sku,
          cartId: nextState.cart.id,
          quantity: payload.quantity,
        });
        return;
      }

      setCartAction({
        status: "failed",
        variantSku: payload.selected_variant_sku,
        reason:
          nextState.error?.message ||
          "The cart service did not confirm the add-to-cart request.",
      });
    }
  }

  const selectedPrice = selectionResult.selectedVariant?.price;
  const addInProgress = cartState.status === "loading" && cartState.operation === "add";

  return (
    <section className="variantSelector" aria-labelledby="variant-selector-title">
      <div className="variantSelectorHeader">
        <div>
          <p className="sectionLabel">Choose a variant</p>
          <h2 id="variant-selector-title">Options and availability</h2>
        </div>
        <p className="selectedPrice">
          {selectedPrice
            ? formatCatalogMoney(
                selectedPrice.amount,
                selectedPrice.currency_code
              )
            : formatPriceRange(product)}
        </p>
      </div>

      {product.option_dimensions
        .filter((dimension) => dimension.values.length > 0)
        .map((dimension) => (
          <fieldset className="optionGroup" key={dimension.name}>
            <legend>{dimension.label}</legend>
            <div className="optionValues">
              {dimension.values.map((value) => {
                const selected = selection[dimension.name] === value;
                return (
                  <button
                    type="button"
                    className={selected ? "optionValue selected" : "optionValue"}
                    aria-pressed={selected}
                    data-option-name={dimension.name}
                    key={value}
                    onClick={() => selectOption(dimension.name, value)}
                  >
                    {formatCatalogValue(value)}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

      <SelectionState result={selectionResult} />

      <div className="cartAction">
        <button
          type="button"
          className="addToCartButton"
          disabled={!selectionResult.canAddToCart || addInProgress}
          onClick={() => void submitSelection()}
        >
          {addInProgress ? "Adding..." : "Add to cart"}
        </button>
        <p>Quantity: 1</p>
      </div>

      {cartAction?.status === "added" ? (
        <section
          className="selectionState selectionState-valid"
          role="status"
          data-handoff-state="cart-action-added"
          data-cart-id={cartAction.cartId}
        >
          <strong>Added to cart</strong>
          <p>
            {cartAction.variantSku}, quantity {cartAction.quantity}, was
            confirmed by the backend cart.
          </p>
          <a className="productDetailLink" href="/cart">
            View cart
          </a>
        </section>
      ) : null}

      {cartAction?.status === "failed" ? (
        <section
          className="handoffFailure"
          role="status"
          data-handoff-state="cart-action-failed"
        >
          <strong>Cart is temporarily unavailable</strong>
          <p>
            {cartAction.variantSku} was not added. {cartAction.reason}
          </p>
        </section>
      ) : null}
    </section>
  );
}

function SelectionState({ result }: { result: VariantSelectionResult }) {
  const content = {
    missing_required_options: {
      title: "Select all required options",
      body:
        result.missingOptionNames.length > 0
          ? `Missing: ${result.missingOptionNames
              .map(formatCatalogValue)
              .join(", ")}.`
          : "Choose a complete variant.",
    },
    impossible_combination: {
      title: "This combination is not available",
      body: "Change one or more options.",
    },
    unavailable_variant: {
      title: "Selected variant is unavailable",
      body: result.selectedVariant
        ? `${result.selectedVariant.sku} cannot be added.`
        : "Choose another variant.",
    },
    valid: {
      title: "Variant is available",
      body: result.selectedVariant
        ? `${result.selectedVariant.sku} is ready to add.`
        : "Selection is valid.",
    },
    no_variants: {
      title: "No sellable variants",
      body: "This product cannot be added right now.",
    },
  }[result.status];

  return (
    <div
      className={`selectionState selectionState-${result.status}`}
      role="status"
      data-selection-status={result.status}
    >
      <strong>{content.title}</strong>
      <p>{content.body}</p>
    </div>
  );
}

function formatPriceRange(product: ProductDetail) {
  const { min, max, currency_code: currencyCode } = product.price_range;

  if (min === null || max === null) {
    return "Price unavailable";
  }

  if (min === max) {
    return formatCatalogMoney(min, currencyCode);
  }

  return `${formatCatalogMoney(min, currencyCode)} - ${formatCatalogMoney(
    max,
    currencyCode
  )}`;
}
