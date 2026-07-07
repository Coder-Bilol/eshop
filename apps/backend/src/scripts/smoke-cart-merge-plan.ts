import assert from "node:assert/strict";
import type {
  CartDTO,
  CreateLineItemDTO,
  ExecArgs,
  ICartModuleService,
} from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import {
  buildCartMergePlan,
  CartMergePlanningError,
  loadCartMergePlanningState,
  normalizeCartForMergePlanning,
} from "../cart-merge/plan";

const REGION_ID = "reg_task019";
const SALES_CHANNEL_ID = "sc_task019";
const VARIANT_A = "variant_task019_a";
const VARIANT_B = "variant_task019_b";
const VARIANT_C = "variant_task019_c";

export default async function smokeCartMergePlan({
  container,
}: ExecArgs) {
  const cartModule = container.resolve<ICartModuleService>(Modules.CART);
  const suffix = `${process.pid}_${Date.now()}`;
  const actorCustomerId = `cus_task019_actor_${suffix}`;
  const foreignCustomerId = `cus_task019_foreign_${suffix}`;
  const createdCartIds: string[] = [];

  try {
    const source = await createCart(
      cartModule,
      createdCartIds,
      {
        currency_code: "rub",
        region_id: REGION_ID,
        sales_channel_id: SALES_CHANNEL_ID,
      },
      [
        line(VARIANT_A, 1),
        line(VARIANT_A, 2),
        line(VARIANT_B, 1),
      ]
    );
    const olderTarget = await createCart(
      cartModule,
      createdCartIds,
      {
        currency_code: "rub",
        region_id: REGION_ID,
        sales_channel_id: SALES_CHANNEL_ID,
        customer_id: actorCustomerId,
      },
      [line(VARIANT_A, 2)]
    );
    await delay(20);
    const newerTarget = await createCart(
      cartModule,
      createdCartIds,
      {
        currency_code: "rub",
        region_id: REGION_ID,
        sales_channel_id: SALES_CHANNEL_ID,
        customer_id: actorCustomerId,
      },
      [line(VARIANT_A, 4), line(VARIANT_C, 7)]
    );
    const incompatibleTarget = await createCart(
      cartModule,
      createdCartIds,
      {
        currency_code: "usd",
        region_id: REGION_ID,
        sales_channel_id: SALES_CHANNEL_ID,
        customer_id: actorCustomerId,
      },
      [line(VARIANT_A, 9)]
    );
    const foreignTarget = await createCart(
      cartModule,
      createdCartIds,
      {
        currency_code: "rub",
        region_id: REGION_ID,
        sales_channel_id: SALES_CHANNEL_ID,
        customer_id: foreignCustomerId,
      },
      [line(VARIANT_A, 11)]
    );

    const before = await cartSnapshot(cartModule, createdCartIds);
    const state = await loadCartMergePlanningState(
      container,
      source.id,
      actorCustomerId
    );
    assert.equal(
      state.candidates.some((candidate) => candidate.id === foreignTarget.id),
      false,
      "Cart Module read must scope candidates by actor customer ID."
    );

    const plan = buildCartMergePlan({
      source: state.source,
      candidates: state.candidates,
      actorCustomerId,
    });
    const newerTargetLine = newerTarget.items?.find(
      (item) => item.variant_id === VARIANT_A
    );

    assert.equal(plan.mode, "merge_into_existing");
    assert.equal(plan.target_cart_id, newerTarget.id);
    assert.equal(plan.customer_id, actorCustomerId);
    assert.deepEqual(
      plan.items.map((item) => item.variant_id),
      [VARIANT_A, VARIANT_B]
    );
    assert.deepEqual(plan.items[0], {
      variant_id: VARIANT_A,
      source_quantity: 3,
      target_quantity_before: 4,
      target_quantity_after: 7,
      target_line_item_id: newerTargetLine?.id ?? null,
    });
    assert.deepEqual(plan.items[1], {
      variant_id: VARIANT_B,
      source_quantity: 1,
      target_quantity_before: 0,
      target_quantity_after: 1,
      target_line_item_id: null,
    });
    assert.equal(Object.isFrozen(plan), true);
    assert.equal(Object.isFrozen(plan.items), true);
    assert.equal(plan.items.every((item) => Object.isFrozen(item)), true);
    assert.notEqual(plan.target_cart_id, olderTarget.id);
    assert.notEqual(plan.target_cart_id, incompatibleTarget.id);

    const after = await cartSnapshot(cartModule, createdCartIds);
    assert.deepEqual(
      after,
      before,
      "Loading and planning must not mutate carts or line items."
    );

    runPurePlanningAssertions(actorCustomerId);

    process.stdout.write(
      `${JSON.stringify(
        {
          suite: "cart-merge-plan",
          status: "ok",
          sourceBoundary: "medusa-cart-module-postgresql",
          sourceCartId: source.id,
          selectedTargetId: plan.target_cart_id,
          actorCandidateCount: state.candidates.length,
          assertions: {
            deterministicTarget: true,
            actorScoped: true,
            compatibilityRejected: true,
            aggregatedByVariantId: true,
            immutableAbsolutePlan: true,
            noMutation: true,
          },
        },
        null,
        2
      )}\n`
    );
  } finally {
    if (createdCartIds.length > 0) {
      await cartModule.deleteCarts([...createdCartIds].reverse());
    }
  }
}

function runPurePlanningAssertions(actorCustomerId: string) {
  const source = normalizeCartForMergePlanning({
    id: "cart_source_fixture",
    currency_code: "rub",
    region_id: REGION_ID,
    sales_channel_id: SALES_CHANNEL_ID,
    updated_at: "2026-07-04T00:00:00.000Z",
    items: [
      { id: "source_b", variant_id: VARIANT_A, quantity: 2 },
      { id: "source_a", variant_id: VARIANT_A, quantity: 1 },
    ],
  });
  const tiedLaterId = planningCart({
    id: "cart_target_b",
    actorCustomerId,
    updatedAt: "2026-07-04T01:00:00.000Z",
    variantId: VARIANT_A,
    quantity: 3,
  });
  const tiedEarlierId = planningCart({
    id: "cart_target_a",
    actorCustomerId,
    updatedAt: "2026-07-04T01:00:00.000Z",
    variantId: VARIANT_A,
    quantity: 4,
  });
  const inputSnapshot = JSON.stringify({
    source,
    candidates: [tiedLaterId, tiedEarlierId],
  });
  const tiePlan = buildCartMergePlan({
    source,
    candidates: [tiedLaterId, tiedEarlierId],
    actorCustomerId,
  });
  assert.equal(tiePlan.target_cart_id, tiedEarlierId.id);
  assert.equal(tiePlan.items[0].source_quantity, 3);
  assert.equal(tiePlan.items[0].target_quantity_before, 4);
  assert.equal(tiePlan.items[0].target_quantity_after, 7);
  assert.equal(
    JSON.stringify({
      source,
      candidates: [tiedLaterId, tiedEarlierId],
    }),
    inputSnapshot,
    "Pure planning must not mutate its inputs."
  );

  const transferPlan = buildCartMergePlan({
    source,
    candidates: [],
    actorCustomerId,
  });
  assert.deepEqual(transferPlan, {
    source_cart_id: source.id,
    target_cart_id: source.id,
    customer_id: actorCustomerId,
    mode: "ownership_transfer",
    items: [],
  });

  for (const incompatible of [
    { ...tiedEarlierId, region_id: "reg_other" },
    { ...tiedEarlierId, currency_code: "usd" },
    { ...tiedEarlierId, sales_channel_id: "sc_other" },
    {
      ...tiedEarlierId,
      completed_at: "2026-07-04T02:00:00.000Z",
    },
  ]) {
    const incompatiblePlan = buildCartMergePlan({
      source,
      candidates: [incompatible],
      actorCustomerId,
    });
    assert.equal(incompatiblePlan.mode, "ownership_transfer");
  }

  assert.throws(
    () =>
      buildCartMergePlan({
        source: { ...source, customer_id: "cus_foreign" },
        candidates: [tiedEarlierId],
        actorCustomerId,
      }),
    isPlanningError("cart_merge_source_forbidden")
  );
  assert.throws(
    () =>
      buildCartMergePlan({
        source,
        candidates: [
          {
            ...tiedEarlierId,
            customer_id: "cus_foreign",
          },
        ],
        actorCustomerId,
      }),
    isPlanningError("cart_merge_candidate_forbidden")
  );
  assert.throws(
    () =>
      buildCartMergePlan({
        source: {
          ...source,
          completed_at: "2026-07-04T02:00:00.000Z",
        },
        candidates: [],
        actorCustomerId,
      }),
    isPlanningError("cart_merge_source_completed")
  );
  assert.throws(
    () =>
      buildCartMergePlan({
        source: {
          ...source,
          items: [
            {
              id: "source_missing_variant",
              variant_id: null,
              quantity: 1,
            },
          ],
        },
        candidates: [tiedEarlierId],
        actorCustomerId,
      }),
    isPlanningError("cart_merge_invalid_cart")
  );
  assert.throws(
    () =>
      buildCartMergePlan({
        source: {
          ...source,
          items: [
            {
              id: "source_overflow_a",
              variant_id: VARIANT_A,
              quantity: Number.MAX_SAFE_INTEGER,
            },
            {
              id: "source_overflow_b",
              variant_id: VARIANT_A,
              quantity: 1,
            },
          ],
        },
        candidates: [tiedEarlierId],
        actorCustomerId,
      }),
    isPlanningError("cart_merge_invalid_cart")
  );
}

function planningCart(input: {
  id: string;
  actorCustomerId: string;
  updatedAt: string;
  variantId: string;
  quantity: number;
}) {
  return normalizeCartForMergePlanning({
    id: input.id,
    currency_code: "rub",
    region_id: REGION_ID,
    sales_channel_id: SALES_CHANNEL_ID,
    customer_id: input.actorCustomerId,
    updated_at: input.updatedAt,
    items: [
      {
        id: `${input.id}_line`,
        variant_id: input.variantId,
        quantity: input.quantity,
      },
    ],
  });
}

function isPlanningError(code: string) {
  return (error: unknown) =>
    error instanceof CartMergePlanningError && error.code === code;
}

async function createCart(
  cartModule: ICartModuleService,
  createdCartIds: string[],
  data: {
    currency_code: string;
    region_id: string;
    sales_channel_id: string;
    customer_id?: string;
  },
  items: CreateLineItemDTO[]
) {
  const cart = await cartModule.createCarts(data);
  createdCartIds.push(cart.id);
  if (items.length > 0) {
    await cartModule.addLineItems(cart.id, items);
  }
  return cartModule.retrieveCart(cart.id, { relations: ["items"] });
}

function line(variantId: string, quantity: number): CreateLineItemDTO {
  return {
    title: variantId,
    variant_id: variantId,
    variant_sku: `${variantId}_display_only`,
    quantity,
    unit_price: 1000,
    is_custom_price: true,
  };
}

async function cartSnapshot(
  cartModule: ICartModuleService,
  cartIds: string[]
) {
  const carts = await cartModule.listCarts(
    { id: cartIds },
    { relations: ["items"], take: cartIds.length }
  );
  return carts
    .map((cart) => ({
      id: cart.id,
      customer_id: cart.customer_id ?? null,
      region_id: cart.region_id ?? null,
      sales_channel_id: cart.sales_channel_id ?? null,
      currency_code: cart.currency_code,
      completed_at: dateValue(cart.completed_at),
      updated_at: dateValue(cart.updated_at),
      items: [...(cart.items ?? [])]
        .map((item) => ({
          id: item.id,
          variant_id: item.variant_id ?? null,
          quantity: numericValue(item.quantity),
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function numericValue(value: unknown) {
  if (typeof value === "object" && value !== null && "value" in value) {
    return Number((value as { value: unknown }).value);
  }
  return Number(value);
}

function dateValue(value: CartDTO["updated_at"] | CartDTO["completed_at"]) {
  if (value === undefined || value === null) return null;
  return new Date(value).toISOString();
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
