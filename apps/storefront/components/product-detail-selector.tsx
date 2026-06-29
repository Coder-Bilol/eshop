"use client";

import { useMemo, useState } from "react";
import { formatCatalogMoney, formatCatalogValue } from "../lib/catalog";
import {
  buildCartActionHandoff,
  resolveVariantSelection,
  type CartActionHandoff,
  type ProductDetail,
  type VariantSelectionResult,
} from "../lib/product-detail";

type Selection = Record<string, string>;

export function ProductDetailSelector({ product }: { product: ProductDetail }) {
  const [selection, setSelection] = useState<Selection>({});
  const [handoff, setHandoff] = useState<CartActionHandoff | null>(null);
  const selectionResult = useMemo(
    () => resolveVariantSelection(product, selection),
    [product, selection]
  );

  function selectOption(name: string, value: string) {
    setSelection((current) => ({
      ...current,
      [name]: value,
    }));
    setHandoff(null);
  }

  function submitSelection() {
    const payload = buildCartActionHandoff(product.handle, selectionResult);
    if (payload) {
      setHandoff(payload);
    }
  }

  const selectedPrice = selectionResult.selectedVariant?.price;

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
          disabled={!selectionResult.canAddToCart}
          onClick={submitSelection}
        >
          Add to cart
        </button>
        <p>Quantity: 1</p>
      </div>

      {handoff ? (
        <section
          className="handoffFailure"
          role="status"
          data-handoff-state="cart-action-unavailable"
        >
          <strong>Cart is temporarily unavailable</strong>
          <p>
            {handoff.selected_variant_sku}, quantity {handoff.quantity}, was not
            added. Try again later.
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
