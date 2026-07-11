import assert from "node:assert/strict";
import type {
  CartDTO,
  ExecArgs,
  ICartModuleService,
  ICustomerModuleService,
} from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import { addToCartWorkflow } from "@medusajs/medusa/core-flows";
import {
  buildCartMergePlan,
  loadCartMergePlanningState,
  type CartMergePlan,
} from "../cart-merge/plan";
import { POST } from "../api/store/carts/[id]/merge/route";
import { CART_MERGE_MODULE } from "../modules/cart-merge";
import type CartMergeModuleService from "../modules/cart-merge/service";
import { mergeCustomerCartWorkflow } from "../workflows/merge-customer-cart";

type CanonicalProduct = {
  id: string;
  variants: Array<{
    id: string;
    availability: {
      is_sellable: boolean;
    };
  }>;
};

type RouteResult = {
  statusCode: number;
  body: any;
};

const { loadCanonicalProducts } = require("../catalog/canonical") as {
  loadCanonicalProducts: (
    container: ExecArgs["container"],
    salesChannelId: string
  ) => Promise<CanonicalProduct[]>;
};

export default async function smokeCartMergeAcceptance({
  container,
}: ExecArgs) {
  const cartModule = container.resolve<ICartModuleService>(Modules.CART);
  const customerModule =
    container.resolve<ICustomerModuleService>(Modules.CUSTOMER);
  const mergeService =
    container.resolve<CartMergeModuleService>(CART_MERGE_MODULE);
  const fixture = await resolveFixture(container);
  const createdCartIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const sourceCartIds: string[] = [];
  const assertions = {
    transferWithOnlyIncompatibleTarget: false,
    deterministicExistingTarget: false,
    sameVariantSummed: false,
    foreignOwnershipDenied: false,
    stockConflictNoMutation: false,
    replayReturnedTarget: false,
    replayNoDuplicateQuantity: false,
    replayDeniedForOtherCustomer: false,
    pendingJournalConcurrencyResponse: false,
    consumedSourceNotFound: false,
    injectedFailureRestoredSource: false,
    injectedFailureRestoredTarget: false,
  };

  try {
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
    const incompatibleTarget = await createCartWithQuantity(
      container,
      cartModule,
      createdCartIds,
      { ...fixture, currencyCode: "usd" },
      transferCustomer.id,
      []
    );
    sourceCartIds.push(transferSource.id);
    const transfer = await postMerge(
      container,
      transferSource.id,
      transferCustomer.id,
      {}
    );
    assert.equal(transfer.statusCode, 200);
    assert.equal(transfer.body.merge.outcome, "transferred");
    assert.equal(transfer.body.cart.id, transferSource.id);
    assert.equal(transfer.body.cart.customer_id, transferCustomer.id);
    const incompatibleAfter = await cartModule.retrieveCart(incompatibleTarget.id, {
      relations: ["items"],
    });
    assert.equal(incompatibleAfter.customer_id, transferCustomer.id);
    assert.equal((incompatibleAfter.items ?? []).length, 0);
    assertions.transferWithOnlyIncompatibleTarget = true;

    const foreignOwner = await createCustomer(
      customerModule,
      createdCustomerIds,
      "foreign-owner"
    );
    const foreignActor = await createCustomer(
      customerModule,
      createdCustomerIds,
      "foreign-actor"
    );
    const foreignSource = await createCartWithQuantity(
      container,
      cartModule,
      createdCartIds,
      fixture,
      foreignOwner.id,
      [{ variantId: fixture.variantIds[0], quantity: 1 }]
    );
    sourceCartIds.push(foreignSource.id);
    assertError(
      await postMerge(container, foreignSource.id, foreignActor.id, {}),
      403,
      "cart_merge_source_forbidden"
    );
    assertions.foreignOwnershipDenied = true;

    const mergeCustomer = await createCustomer(
      customerModule,
      createdCustomerIds,
      "merge"
    );
    const mergeSource = await createCartWithQuantity(
      container,
      cartModule,
      createdCartIds,
      fixture,
      null,
      [{ variantId: fixture.variantIds[0], quantity: 2 }]
    );
    const olderTarget = await createCartWithQuantity(
      container,
      cartModule,
      createdCartIds,
      fixture,
      mergeCustomer.id,
      [{ variantId: fixture.variantIds[0], quantity: 1 }]
    );
    await delay(20);
    const newerTarget = await createCartWithQuantity(
      container,
      cartModule,
      createdCartIds,
      fixture,
      mergeCustomer.id,
      [{ variantId: fixture.variantIds[0], quantity: 3 }]
    );
    sourceCartIds.push(mergeSource.id);
    const merged = await postMerge(container, mergeSource.id, mergeCustomer.id, {});
    assert.equal(merged.statusCode, 200);
    assert.equal(merged.body.merge.outcome, "merged");
    assert.equal(merged.body.merge.target_cart_id, newerTarget.id);
    assert.equal(quantityFor(merged.body.cart, fixture.variantIds[0]), 5);
    const olderAfter = await cartModule.retrieveCart(olderTarget.id, {
      relations: ["items"],
    });
    assert.equal(quantityFor(olderAfter, fixture.variantIds[0]), 1);
    await assert.rejects(() =>
      cartModule.retrieveCart(mergeSource.id, { relations: ["items"] })
    );
    const completedJournal = await journalFor(mergeService, mergeSource.id);
    assert.equal(completedJournal.status, "completed");
    assert.equal(completedJournal.target_cart_id, newerTarget.id);
    assertions.deterministicExistingTarget = true;
    assertions.sameVariantSummed = true;
    assertions.consumedSourceNotFound = true;

    const replay = await postMerge(container, mergeSource.id, mergeCustomer.id, {});
    assert.equal(replay.statusCode, 200);
    assert.equal(replay.body.merge.outcome, "already_merged");
    assert.equal(replay.body.merge.replayed, true);
    assert.equal(replay.body.merge.target_cart_id, newerTarget.id);
    assert.equal(quantityFor(replay.body.cart, fixture.variantIds[0]), 5);
    assertError(
      await postMerge(container, mergeSource.id, foreignActor.id, {}),
      403,
      "cart_merge_source_forbidden"
    );
    assertions.replayReturnedTarget = true;
    assertions.replayNoDuplicateQuantity = true;
    assertions.replayDeniedForOtherCustomer = true;

    const pendingCustomer = await createCustomer(
      customerModule,
      createdCustomerIds,
      "pending"
    );
    const pendingSource = await createCartWithQuantity(
      container,
      cartModule,
      createdCartIds,
      fixture,
      null,
      [{ variantId: fixture.variantIds[0], quantity: 1 }]
    );
    const pendingTarget = await createCartWithQuantity(
      container,
      cartModule,
      createdCartIds,
      fixture,
      pendingCustomer.id,
      [{ variantId: fixture.variantIds[0], quantity: 1 }]
    );
    sourceCartIds.push(pendingSource.id);
    await createPendingJournal(
      mergeService,
      await planFor(container, pendingSource.id, pendingCustomer.id)
    );
    assertError(
      await postMerge(container, pendingSource.id, pendingCustomer.id, {}),
      409,
      "cart_merge_in_progress"
    );
    const pendingTargetAfter = await cartModule.retrieveCart(pendingTarget.id, {
      relations: ["items"],
    });
    assert.equal(quantityFor(pendingTargetAfter, fixture.variantIds[0]), 1);
    assertions.pendingJournalConcurrencyResponse = true;

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
    assertError(
      await postMerge(container, stockSource.id, stockCustomer.id, {}),
      409,
      "cart_merge_stock_conflict"
    );
    const stockSourceAfter = await cartModule.retrieveCart(stockSource.id, {
      relations: ["items"],
    });
    const stockTargetAfter = await cartModule.retrieveCart(stockTarget.id, {
      relations: ["items"],
    });
    assert.equal(quantityFor(stockSourceAfter, fixture.variantIds[0]), 60);
    assert.equal(quantityFor(stockTargetAfter, fixture.variantIds[0]), 60);
    assertions.stockConflictNoMutation = true;

    const recoveryCustomer = await createCustomer(
      customerModule,
      createdCustomerIds,
      "recovery"
    );
    const recoverySource = await createCartWithQuantity(
      container,
      cartModule,
      createdCartIds,
      fixture,
      null,
      [{ variantId: fixture.variantIds[0], quantity: 2 }]
    );
    const recoveryTarget = await createCartWithQuantity(
      container,
      cartModule,
      createdCartIds,
      fixture,
      recoveryCustomer.id,
      [{ variantId: fixture.variantIds[0], quantity: 3 }]
    );
    sourceCartIds.push(recoverySource.id);
    const recoveryPlan = await planFor(
      container,
      recoverySource.id,
      recoveryCustomer.id
    );
    await assert.rejects(() =>
      mergeCustomerCartWorkflow(container).run({
        input: {
          plan: recoveryPlan,
          inject_failure_after_source_soft_delete: true,
        },
      })
    );
    const restoredSource = await cartModule.retrieveCart(recoverySource.id, {
      relations: ["items"],
    });
    const restoredTarget = await cartModule.retrieveCart(recoveryTarget.id, {
      relations: ["items"],
    });
    const failedJournal = await journalFor(mergeService, recoverySource.id);
    assert.equal(quantityFor(restoredSource, fixture.variantIds[0]), 2);
    assert.equal(quantityFor(restoredTarget, fixture.variantIds[0]), 3);
    assert.equal(failedJournal.status, "failed");
    assert.equal(failedJournal.failure_code, "cart_merge_injected_failure");
    assertions.injectedFailureRestoredSource = true;
    assertions.injectedFailureRestoredTarget = true;

    process.stdout.write(
      `${JSON.stringify(
        {
          suite: "cart-merge-acceptance",
          status: "ok",
          sourceBoundary: "medusa-route-workflow-module-postgresql",
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
      createdCartIds,
      createdCustomerIds,
      sourceCartIds
    );
  }
}

async function resolveFixture(container: ExecArgs["container"]) {
  const storeModule = container.resolve(Modules.STORE);
  const regionModule = container.resolve(Modules.REGION);
  const [store] = await storeModule.listStores();
  const [region] = await regionModule.listRegions({ currency_code: "rub" });
  if (!store?.default_sales_channel_id || !region) {
    throw new Error(
      "TASK-025 requires the seeded local RUB region and default sales channel."
    );
  }

  const products = await loadCanonicalProducts(
    container,
    store.default_sales_channel_id
  );
  const variant = products
    .flatMap((product) => product.variants)
    .find((candidate) => candidate.availability.is_sellable);
  if (!variant) {
    throw new Error("TASK-025 requires a sellable canonical Medusa variant.");
  }

  return {
    regionId: region.id,
    salesChannelId: store.default_sales_channel_id,
    currencyCode: "rub",
    variantIds: [variant.id],
  };
}

async function createCustomer(
  customerModule: ICustomerModuleService,
  createdCustomerIds: string[],
  label: string
) {
  const suffix = `${process.pid}_${Date.now()}_${label}`;
  const customer = await customerModule.createCustomers({
    email: `task025_${suffix}@example.test`,
    first_name: "TASK-025",
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
    currencyCode: string;
    variantIds: string[];
  },
  customerId: string | null,
  items: Array<{ variantId: string; quantity: number }>
) {
  const cart = await cartModule.createCarts({
    currency_code: fixture.currencyCode,
    region_id: fixture.regionId,
    sales_channel_id: fixture.salesChannelId,
    shipping_address: {
      first_name: "TASK-025",
      last_name: "Acceptance",
      address_1: "Local integration",
      city: "Moscow",
      country_code: "ru",
    },
    ...(customerId ? { customer_id: customerId } : {}),
  });
  createdCartIds.push(cart.id);

  if (items.length > 0) {
    await addToCartWorkflow(container).run({
      input: {
        cart_id: cart.id,
        items: items.map((item) => ({
          variant_id: item.variantId,
          quantity: item.quantity,
        })),
      },
    });
  }

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

async function createPendingJournal(
  mergeService: CartMergeModuleService,
  plan: CartMergePlan
) {
  await mergeService.createCartMerges({
    source_cart_id: plan.source_cart_id,
    target_cart_id: plan.target_cart_id,
    customer_id: plan.customer_id,
    mode: plan.mode,
    status: "pending",
    plan,
    failure_code: null,
    attempt_count: 1,
    completed_at: null,
  });
}

async function journalFor(
  service: CartMergeModuleService,
  sourceCartId: string
) {
  const journals = await service.listCartMerges({ source_cart_id: sourceCartId });
  assert.equal(journals.length, 1);
  return journals[0];
}

async function postMerge(
  container: ExecArgs["container"],
  sourceCartId: string,
  actorCustomerId: string | null,
  body: Record<string, unknown>
): Promise<RouteResult> {
  const res = new TestResponse();
  await POST(
    {
      scope: container,
      params: { id: sourceCartId },
      body,
      validatedBody: body,
      auth_context: actorCustomerId
        ? {
            actor_id: actorCustomerId,
            actor_type: "customer",
            auth_identity_id: `auth_identity_${actorCustomerId}`,
            app_metadata: {},
            user_metadata: {},
          }
        : undefined,
    } as any,
    res as any
  );
  return { statusCode: res.statusCode, body: res.body };
}

class TestResponse {
  public statusCode = 200;
  public body: any = undefined;

  status(statusCode: number) {
    this.statusCode = statusCode;
    return this;
  }

  json(body: unknown) {
    this.body = body;
    return this;
  }
}

function assertError(result: RouteResult, statusCode: number, code: string) {
  assert.equal(result.statusCode, statusCode);
  assert.equal(result.body.error.code, code);
  assert.equal(typeof result.body.error.message, "string");
  assert.deepEqual(result.body.error.details, {});
}

function quantityFor(cart: CartDTO, variantId: string) {
  return (cart.items ?? [])
    .filter((item) => item.variant_id === variantId)
    .reduce((total, item) => total + numericValue(item.quantity), 0);
}

function numericValue(value: unknown) {
  if (typeof value === "object" && value !== null && "value" in value) {
    return Number((value as { value: unknown }).value);
  }
  return Number(value);
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function cleanup(
  cartModule: ICartModuleService,
  customerModule: ICustomerModuleService,
  mergeService: CartMergeModuleService,
  cartIds: string[],
  customerIds: string[],
  sourceCartIds: string[]
) {
  if (sourceCartIds.length > 0) {
    const journals = await mergeService.listCartMerges({
      source_cart_id: sourceCartIds,
    });
    if (journals.length > 0) {
      await mergeService.deleteCartMerges(journals.map((journal) => journal.id));
    }
  }

  for (const cartId of [...cartIds].reverse()) {
    await cartModule.restoreCarts([cartId]).catch(() => undefined);
    await cartModule.deleteCarts(cartId).catch(() => undefined);
  }
  for (const customerId of [...customerIds].reverse()) {
    await customerModule.deleteCustomers(customerId).catch(() => undefined);
  }
}
