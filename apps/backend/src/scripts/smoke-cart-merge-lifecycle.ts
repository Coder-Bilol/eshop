import assert from "node:assert/strict";
import type {
  CartDTO,
  ExecArgs,
  ICartModuleService,
  ICustomerModuleService,
  IPromotionModuleService,
} from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  PromotionActions,
} from "@medusajs/framework/utils";
import {
  addToCartWorkflow,
  updateCartPromotionsWorkflow,
} from "@medusajs/medusa/core-flows";
import {
  buildCartMergePlan,
  loadCartMergePlanningState,
} from "../cart-merge/plan";
import {
  CART_MERGE_MODULE,
} from "../modules/cart-merge";
import type CartMergeModuleService from "../modules/cart-merge/service";
import {
  mergeCustomerCartWorkflow,
} from "../workflows/merge-customer-cart";

type CanonicalProduct = {
  id: string;
  variants: Array<{
    id: string;
    availability: {
      is_sellable: boolean;
    };
  }>;
};

const { loadCanonicalProducts } = require("../catalog/canonical") as {
  loadCanonicalProducts: (
    container: ExecArgs["container"],
    salesChannelId: string
  ) => Promise<CanonicalProduct[]>;
};

export default async function smokeCartMergeLifecycle({
  container,
}: ExecArgs) {
  const cartModule = container.resolve<ICartModuleService>(Modules.CART);
  const customerModule =
    container.resolve<ICustomerModuleService>(Modules.CUSTOMER);
  const promotionModule =
    container.resolve<IPromotionModuleService>(Modules.PROMOTION);
  const mergeService =
    container.resolve<CartMergeModuleService>(CART_MERGE_MODULE);
  const fixture = await resolveFixture(container);
  const createdCartIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const sourceCartIds: string[] = [];
  const createdPromotionIds: string[] = [];
  const assertions = {
    transferKeepsSourceActive: false,
    transferRefreshesCustomerPricing: false,
    targetBeforeSourceDisposition: false,
    sourceSoftDeletedBeforeJournalCompletion: false,
    restoreBeforeReverseCompensation: false,
    newTargetLineCreatedAndCompensated: false,
    targetPricingIgnoresSourceSnapshot: false,
    targetDuplicateVariantLinesMerged: false,
    targetTotalsMatchCoreWorkflow: false,
    targetTaxesRecalculated: false,
    targetPromotionsRecalculated: false,
    stockFailureLeavesBothUsable: false,
    failedJournalRetryCompletes: false,
  };

  try {
    const promotion = await promotionModule.createPromotions({
      code: `TASK020_${process.pid}_${Date.now()}`,
      type: "standard",
      status: "active",
      application_method: {
        type: "percentage",
        target_type: "items",
        allocation: "across",
        value: 10,
      },
    });
    createdPromotionIds.push(promotion.id);

    const transferCustomer = await createCustomer(
      customerModule,
      createdCustomerIds,
      "transfer"
    );
    const transferSource = await createCartWithQuantity(
      container,
      cartModule,
      createdCartIds,
      fixture,
      null,
      [{ variantId: fixture.variantIds[0], quantity: 1 }]
    );
    sourceCartIds.push(transferSource.id);
    await poisonSourcePrice(
      cartModule,
      transferSource,
      fixture.variantIds[0]
    );
    const transferPlan = await planFor(
      container,
      transferSource.id,
      transferCustomer.id
    );
    const { result: transferResult } =
      await mergeCustomerCartWorkflow(container).run({
        input: { plan: transferPlan },
      });
    const transferred = await cartModule.retrieveCart(transferSource.id, {
      relations: ["items"],
    });
    assert.equal(transferResult.mode, "ownership_transfer");
    assert.deepEqual(transferResult.operation_trace, [
      "source_ownership_transferred",
      "journal_completed",
    ]);
    assert.equal(transferred.customer_id, transferCustomer.id);
    assert.equal(quantityFor(transferred, fixture.variantIds[0]), 1);
    assert.notEqual(
      lineFor(transferred, fixture.variantIds[0]).unit_price,
      1
    );
    assertions.transferKeepsSourceActive = true;
    assertions.transferRefreshesCustomerPricing = true;

    const mergeCustomer = await createCustomer(
      customerModule,
      createdCustomerIds,
      "merge"
    );
    const duplicateTargetItems = [
      { variantId: fixture.variantIds[0], quantity: 2 },
      {
        variantId: fixture.variantIds[0],
        quantity: 1,
        metadata: { task020_duplicate_variant_line: true },
      },
    ];
    const mergeSource = await createCartWithQuantity(
      container,
      cartModule,
      createdCartIds,
      fixture,
      null,
      [
        { variantId: fixture.variantIds[0], quantity: 2 },
        { variantId: fixture.variantIds[1], quantity: 1 },
      ]
    );
    const mergeTarget = await createCartWithQuantity(
      container,
      cartModule,
      createdCartIds,
      fixture,
      mergeCustomer.id,
      duplicateTargetItems
    );
    assert.equal(linesFor(mergeTarget, fixture.variantIds[0]).length, 2);
    sourceCartIds.push(mergeSource.id);
    await poisonSourcePrice(
      cartModule,
      mergeSource,
      fixture.variantIds[1]
    );
    await updateCartPromotionsWorkflow(container).run({
      input: {
        cart_id: mergeTarget.id,
        promo_codes: [promotion.code!],
        action: PromotionActions.ADD,
      },
    });
    const mergePlan = await planFor(
      container,
      mergeSource.id,
      mergeCustomer.id
    );
    const sameVariantPlanItem = mergePlan.items.find(
      (item) => item.variant_id === fixture.variantIds[0]
    );
    assert.ok(sameVariantPlanItem);
    assert.equal(sameVariantPlanItem.target_quantity_before, 3);
    assert.ok(sameVariantPlanItem.target_line_item_id);

    await assert.rejects(() =>
      mergeCustomerCartWorkflow(container).run({
        input: {
          plan: mergePlan,
          inject_failure_after_source_soft_delete: true,
        },
      })
    );

    const restoredSource = await cartModule.retrieveCart(mergeSource.id, {
      relations: ["items"],
    });
    const compensatedTarget = await cartModule.retrieveCart(mergeTarget.id, {
      relations: ["items"],
    });
    const failedJournal = await journalFor(mergeService, mergeSource.id);
    assert.equal(quantityFor(restoredSource, fixture.variantIds[0]), 2);
    assert.equal(quantityFor(restoredSource, fixture.variantIds[1]), 1);
    assert.equal(quantityFor(compensatedTarget, fixture.variantIds[0]), 3);
    assert.equal(linesFor(compensatedTarget, fixture.variantIds[0]).length, 2);
    assert.equal(quantityFor(compensatedTarget, fixture.variantIds[1]), 0);
    assert.equal(failedJournal.status, "failed");
    assert.equal(
      failedJournal.failure_code,
      "cart_merge_injected_failure"
    );
    assertions.restoreBeforeReverseCompensation = true;

    const { result: mergeResult } =
      await mergeCustomerCartWorkflow(container).run({
        input: { plan: mergePlan },
      });
    const expectedMutationTrace = [...fixture.variantIds]
      .sort()
      .map((variantId) => `target_mutated:${variantId}`);
    assert.deepEqual(mergeResult.operation_trace, [
      ...expectedMutationTrace,
      "source_soft_deleted",
      "journal_completed",
    ]);
    assert.ok(
      mergeResult.operation_trace.indexOf("source_soft_deleted") >
        Math.max(
          ...expectedMutationTrace.map((entry) =>
            mergeResult.operation_trace.indexOf(entry)
          )
        )
    );
    const mergedTarget = await cartModule.retrieveCart(mergeTarget.id, {
      relations: ["items"],
    });
    assert.equal(quantityFor(mergedTarget, fixture.variantIds[0]), 5);
    assert.equal(linesFor(mergedTarget, fixture.variantIds[0]).length, 2);
    assert.equal(quantityFor(mergedTarget, fixture.variantIds[1]), 1);
    assert.notEqual(
      lineFor(mergedTarget, fixture.variantIds[1]).unit_price,
      1
    );
    assertions.targetPricingIgnoresSourceSnapshot = true;

    const referenceTarget = await createCartWithQuantity(
      container,
      cartModule,
      createdCartIds,
      fixture,
      mergeCustomer.id,
      duplicateTargetItems
    );
    await updateCartPromotionsWorkflow(container).run({
      input: {
        cart_id: referenceTarget.id,
        promo_codes: [promotion.code!],
        action: PromotionActions.ADD,
      },
    });
    await addToCartWorkflow(container).run({
      input: {
        cart_id: referenceTarget.id,
        items: [
          { variant_id: fixture.variantIds[0], quantity: 2 },
          { variant_id: fixture.variantIds[1], quantity: 1 },
        ],
      },
    });
    const mergedPricing = await cartPricingSnapshot(
      container,
      mergeTarget.id
    );
    const referencePricing = await cartPricingSnapshot(
      container,
      referenceTarget.id
    );
    assert.deepEqual(mergedPricing, referencePricing);
    assert.ok(mergedPricing.tax_total > 0);
    assert.ok(mergedPricing.discount_total > 0);
    assert.deepEqual(mergedPricing.promotion_codes, [promotion.code]);
    assertions.targetDuplicateVariantLinesMerged = true;
    assertions.targetTotalsMatchCoreWorkflow = true;
    assertions.targetTaxesRecalculated = true;
    assertions.targetPromotionsRecalculated = true;
    assertions.newTargetLineCreatedAndCompensated = true;
    await assert.rejects(() => cartModule.retrieveCart(mergeSource.id));
    const completedJournal = await journalFor(
      mergeService,
      mergeSource.id
    );
    assert.equal(completedJournal.status, "completed");
    assert.ok(completedJournal.completed_at);
    assert.equal(Number(completedJournal.attempt_count), 2);
    assertions.targetBeforeSourceDisposition = true;
    assertions.sourceSoftDeletedBeforeJournalCompletion = true;
    assertions.failedJournalRetryCompletes = true;

    const stockCustomer = await createCustomer(
      customerModule,
      createdCustomerIds,
      "stock"
    );
    const stockSource = await createCartWithQuantity(
      container,
      cartModule,
      createdCartIds,
      fixture,
      null,
      [{ variantId: fixture.variantIds[0], quantity: 60 }]
    );
    const stockTarget = await createCartWithQuantity(
      container,
      cartModule,
      createdCartIds,
      fixture,
      stockCustomer.id,
      [{ variantId: fixture.variantIds[0], quantity: 60 }]
    );
    sourceCartIds.push(stockSource.id);
    const stockPlan = await planFor(
      container,
      stockSource.id,
      stockCustomer.id
    );

    await assert.rejects(() =>
      mergeCustomerCartWorkflow(container).run({
        input: { plan: stockPlan },
      })
    );
    const stockSourceAfter = await cartModule.retrieveCart(stockSource.id, {
      relations: ["items"],
    });
    const stockTargetAfter = await cartModule.retrieveCart(stockTarget.id, {
      relations: ["items"],
    });
    const stockJournal = await journalFor(mergeService, stockSource.id);
    assert.equal(quantityFor(stockSourceAfter, fixture.variantIds[0]), 60);
    assert.equal(quantityFor(stockTargetAfter, fixture.variantIds[0]), 60);
    assert.equal(stockJournal.status, "failed");
    assert.equal(stockJournal.completed_at, null);
    assert.equal(
      stockJournal.failure_code,
      "cart_merge_stock_conflict"
    );
    assertions.stockFailureLeavesBothUsable = true;

    process.stdout.write(
      `${JSON.stringify(
        {
          suite: "cart-merge-lifecycle",
          status: "ok",
          sourceBoundary: "medusa-workflow-cart-module-postgresql",
          assertions,
        },
        null,
        2
      )}\n`
    );
  } finally {
    await cleanup(
      cartModule,
      customerModule,
      mergeService,
      promotionModule,
      createdCartIds,
      createdCustomerIds,
      sourceCartIds,
      createdPromotionIds
    );
  }
}

async function resolveFixture(container: ExecArgs["container"]) {
  const storeModule = container.resolve(Modules.STORE);
  const regionModule = container.resolve(Modules.REGION);
  const [store] = await storeModule.listStores();
  const [region] = await regionModule.listRegions({
    currency_code: "rub",
  });
  if (!store?.default_sales_channel_id || !region) {
    throw new Error(
      "TASK-020 requires the seeded local RUB region and default sales channel."
    );
  }

  const products = await loadCanonicalProducts(
    container,
    store.default_sales_channel_id
  );
  const variants = products
    .flatMap((product) =>
      product.variants.map((variant) => ({
        ...variant,
        productId: product.id,
      }))
    )
    .filter((candidate) => candidate.availability.is_sellable)
    .slice(0, 2);
  if (variants.length < 2) {
    throw new Error(
      "TASK-020 requires two sellable canonical Medusa variants."
    );
  }

  return {
    regionId: region.id,
    salesChannelId: store.default_sales_channel_id,
    variantIds: variants.map((variant) => variant.id),
    productIds: variants.map((variant) => variant.productId),
  };
}

async function createCustomer(
  customerModule: ICustomerModuleService,
  createdCustomerIds: string[],
  label: string
) {
  const suffix = `${process.pid}_${Date.now()}_${label}`;
  const customer = await customerModule.createCustomers({
    email: `task020_${suffix}@example.test`,
    first_name: "TASK-020",
    last_name: label,
    has_account: true,
  });
  createdCustomerIds.push(customer.id);
  return customer;
}

async function createCartWithQuantity(
  container: ExecArgs["container"],
  cartModule: ICartModuleService,
  createdCartIds: string[],
  fixture: {
    regionId: string;
    salesChannelId: string;
    variantIds: string[];
    productIds: string[];
  },
  customerId: string | null,
  items: Array<{
    variantId: string;
    quantity: number;
    metadata?: Record<string, unknown>;
  }>
) {
  const cart = await cartModule.createCarts({
    currency_code: "rub",
    region_id: fixture.regionId,
    sales_channel_id: fixture.salesChannelId,
    shipping_address: {
      first_name: "TASK-020",
      last_name: "Lifecycle",
      address_1: "Local integration",
      city: "Moscow",
      country_code: "ru",
    },
    ...(customerId ? { customer_id: customerId } : {}),
  });
  createdCartIds.push(cart.id);
  await addToCartWorkflow(container).run({
    input: {
      cart_id: cart.id,
      items: items.map((item) => ({
        variant_id: item.variantId,
        quantity: item.quantity,
        ...(item.metadata ? { metadata: item.metadata } : {}),
      })),
    },
  });
  return cartModule.retrieveCart(cart.id, { relations: ["items"] });
}

async function planFor(
  container: ExecArgs["container"],
  sourceCartId: string,
  customerId: string
) {
  const state = await loadCartMergePlanningState(
    container,
    sourceCartId,
    customerId
  );
  return buildCartMergePlan({
    source: state.source,
    candidates: state.candidates,
    actorCustomerId: customerId,
  });
}

async function journalFor(
  service: CartMergeModuleService,
  sourceCartId: string
) {
  const journals = await service.listCartMerges({
    source_cart_id: sourceCartId,
  });
  assert.equal(journals.length, 1);
  return journals[0];
}

function quantityFor(cart: CartDTO, variantId: string) {
  return (cart.items ?? [])
    .filter((item) => item.variant_id === variantId)
    .reduce((total, item) => total + numericValue(item.quantity), 0);
}

function lineFor(cart: CartDTO, variantId: string) {
  const line = linesFor(cart, variantId)[0];
  assert.ok(line);
  return line;
}

function linesFor(cart: CartDTO, variantId: string) {
  return (cart.items ?? []).filter((item) => item.variant_id === variantId);
}

async function poisonSourcePrice(
  cartModule: ICartModuleService,
  cart: CartDTO,
  variantId: string
) {
  const line = lineFor(cart, variantId);
  await cartModule.updateLineItems(line.id, {
    unit_price: 1,
    is_custom_price: false,
  });
}

async function cartPricingSnapshot(
  container: ExecArgs["container"],
  cartId: string
) {
  const query = container.resolve(
    ContainerRegistrationKeys.QUERY
  ) as unknown as {
    graph: (
      input: Record<string, unknown>
    ) => Promise<{ data: any[] }>;
  };
  const { data } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "total",
      "subtotal",
      "tax_total",
      "discount_total",
      "item_total",
      "item_subtotal",
      "item_tax_total",
      "promotions.code",
      "items.variant_id",
      "items.quantity",
      "items.unit_price",
      "items.subtotal",
      "items.total",
      "items.tax_total",
      "items.discount_total",
      "items.tax_lines.code",
      "items.tax_lines.rate",
      "items.adjustments.amount",
      "items.adjustments.code",
    ],
    filters: { id: cartId },
    options: { isList: false },
  });
  const cart = data[0];
  assert.ok(cart);

  return {
    total: numericAmount(cart.total),
    subtotal: numericAmount(cart.subtotal),
    tax_total: numericAmount(cart.tax_total),
    discount_total: numericAmount(cart.discount_total),
    item_total: numericAmount(cart.item_total),
    item_subtotal: numericAmount(cart.item_subtotal),
    item_tax_total: numericAmount(cart.item_tax_total),
    promotion_codes: (cart.promotions ?? [])
      .map((promotion: { code: string }) => promotion.code)
      .sort(),
    items: (cart.items ?? [])
      .map((item: any) => ({
        variant_id: item.variant_id,
        quantity: numericAmount(item.quantity),
        unit_price: numericAmount(item.unit_price),
        subtotal: numericAmount(item.subtotal),
        total: numericAmount(item.total),
        tax_total: numericAmount(item.tax_total),
        discount_total: numericAmount(item.discount_total),
        tax_lines: (item.tax_lines ?? [])
          .map((line: any) => ({
            code: line.code,
            rate: numericAmount(line.rate),
          }))
          .sort((left: any, right: any) =>
            String(left.code).localeCompare(String(right.code))
          ),
        adjustments: (item.adjustments ?? [])
          .map((adjustment: any) => ({
            code: adjustment.code,
            amount: numericAmount(adjustment.amount),
          }))
          .sort((left: any, right: any) =>
            String(left.code).localeCompare(String(right.code))
          ),
      }))
      .sort((left: any, right: any) =>
        left.variant_id.localeCompare(right.variant_id) ||
        left.quantity - right.quantity ||
        left.unit_price - right.unit_price ||
        left.subtotal - right.subtotal ||
        left.total - right.total
      ),
  };
}

function numericAmount(value: unknown) {
  if (value === undefined || value === null) return 0;
  if (typeof value === "object" && "value" in value) {
    return Number((value as { value: unknown }).value);
  }
  return Number(value);
}

function numericValue(value: unknown) {
  if (typeof value === "object" && value !== null && "value" in value) {
    return Number((value as { value: unknown }).value);
  }
  return Number(value);
}

async function cleanup(
  cartModule: ICartModuleService,
  customerModule: ICustomerModuleService,
  mergeService: CartMergeModuleService,
  promotionModule: IPromotionModuleService,
  cartIds: string[],
  customerIds: string[],
  sourceCartIds: string[],
  promotionIds: string[]
) {
  const journals = await mergeService.listCartMerges({
    source_cart_id: sourceCartIds,
  });
  if (journals.length > 0) {
    await mergeService.deleteCartMerges(journals.map((journal) => journal.id));
  }

  for (const cartId of [...cartIds].reverse()) {
    await cartModule.restoreCarts([cartId]).catch(() => undefined);
    await cartModule.deleteCarts(cartId).catch(() => undefined);
  }
  for (const customerId of [...customerIds].reverse()) {
    await customerModule.deleteCustomers(customerId).catch(() => undefined);
  }
  if (promotionIds.length > 0) {
    await promotionModule
      .deletePromotions(promotionIds)
      .catch(() => undefined);
  }
}
