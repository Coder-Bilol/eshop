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
import mergeMiddlewares from "../api/middlewares";
import { POST } from "../api/store/carts/[id]/merge/route";
import { CART_MERGE_MODULE } from "../modules/cart-merge";
import type CartMergeModuleService from "../modules/cart-merge/service";

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

export default async function smokeCartMergeApi({ container }: ExecArgs) {
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
    middlewareRegistered: false,
    authRequired: false,
    emptyBodyOnly: false,
    transferOutcome: false,
    foreignSourceDenied: false,
    existingTargetMerged: false,
    journalFirstReplay: false,
    replayDoesNotDuplicate: false,
    replayForeignCustomerDenied: false,
    pendingJournalReturnsInProgress: false,
    stockConflictStable: false,
  };

  try {
    const middlewareRoute = mergeMiddlewares.routes?.find(
      (route) => route.matcher === "/store/carts/:id/merge"
    );
    assert.ok(middlewareRoute);
    assert.deepEqual(
      middlewareRoute.method ?? middlewareRoute.methods,
      ["POST"]
    );
    assert.equal(middlewareRoute.middlewares?.length, 1);
    assertions.middlewareRegistered = true;

    const unauthenticatedSource = await createCartWithQuantity(
      container,
      cartModule,
      createdCartIds,
      fixture,
      null,
      [{ variantId: fixture.variantIds[0], quantity: 1 }]
    );
    sourceCartIds.push(unauthenticatedSource.id);
    const unauthenticated = await postMerge(
      container,
      unauthenticatedSource.id,
      null,
      {}
    );
    assertError(unauthenticated, 401, "cart_merge_auth_required");
    assertions.authRequired = true;

    const validationCustomer = await createCustomer(
      customerModule,
      createdCustomerIds,
      "validation"
    );
    const invalidBody = await postMerge(
      container,
      unauthenticatedSource.id,
      validationCustomer.id,
      {
        target_cart_id: "cart_forbidden",
        customer_id: validationCustomer.id,
      }
    );
    assertError(invalidBody, 400, "cart_merge_invalid_request");
    assertions.emptyBodyOnly = true;

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
    const transfer = await postMerge(
      container,
      transferSource.id,
      transferCustomer.id,
      {}
    );
    assert.equal(transfer.statusCode, 200);
    assert.equal(transfer.body.merge.outcome, "transferred");
    assert.equal(transfer.body.merge.replayed, false);
    assert.equal(transfer.body.cart.id, transferSource.id);
    assert.equal(transfer.body.cart.customer_id, transferCustomer.id);
    assertions.transferOutcome = true;

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
    const foreign = await postMerge(
      container,
      foreignSource.id,
      foreignActor.id,
      {}
    );
    assertError(foreign, 403, "cart_merge_source_forbidden");
    assertions.foreignSourceDenied = true;

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
    const mergeTarget = await createCartWithQuantity(
      container,
      cartModule,
      createdCartIds,
      fixture,
      mergeCustomer.id,
      [{ variantId: fixture.variantIds[0], quantity: 3 }]
    );
    sourceCartIds.push(mergeSource.id);
    const merge = await postMerge(container, mergeSource.id, mergeCustomer.id, {});
    assert.equal(merge.statusCode, 200);
    assert.equal(merge.body.merge.outcome, "merged");
    assert.equal(merge.body.merge.target_cart_id, mergeTarget.id);
    assert.equal(quantityFor(merge.body.cart, fixture.variantIds[0]), 5);
    await assert.rejects(() => cartModule.retrieveCart(mergeSource.id));
    assertions.existingTargetMerged = true;

    const replay = await postMerge(container, mergeSource.id, mergeCustomer.id, {});
    assert.equal(replay.statusCode, 200);
    assert.equal(replay.body.merge.outcome, "already_merged");
    assert.equal(replay.body.merge.replayed, true);
    assert.equal(replay.body.merge.target_cart_id, mergeTarget.id);
    assert.equal(quantityFor(replay.body.cart, fixture.variantIds[0]), 5);
    assertions.journalFirstReplay = true;
    assertions.replayDoesNotDuplicate = true;

    const replayDenied = await postMerge(
      container,
      mergeSource.id,
      foreignActor.id,
      {}
    );
    assertError(replayDenied, 403, "cart_merge_source_forbidden");
    assertions.replayForeignCustomerDenied = true;

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
    const pendingPlan = await planFor(
      container,
      pendingSource.id,
      pendingCustomer.id
    );
    await createPendingJournal(mergeService, pendingPlan);
    const pending = await postMerge(
      container,
      pendingSource.id,
      pendingCustomer.id,
      {}
    );
    assertError(pending, 409, "cart_merge_in_progress");
    assert.equal(quantityFor(pendingTarget, fixture.variantIds[0]), 1);
    assertions.pendingJournalReturnsInProgress = true;

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
    const stock = await postMerge(container, stockSource.id, stockCustomer.id, {});
    assertError(stock, 409, "cart_merge_stock_conflict");
    const stockSourceAfter = await cartModule.retrieveCart(stockSource.id, {
      relations: ["items"],
    });
    const stockTargetAfter = await cartModule.retrieveCart(stockTarget.id, {
      relations: ["items"],
    });
    assert.equal(quantityFor(stockSourceAfter, fixture.variantIds[0]), 60);
    assert.equal(quantityFor(stockTargetAfter, fixture.variantIds[0]), 60);
    assertions.stockConflictStable = true;

    process.stdout.write(
      `${JSON.stringify(
        {
          suite: "cart-merge-api",
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
  const [region] = await regionModule.listRegions({
    currency_code: "rub",
  });
  if (!store?.default_sales_channel_id || !region) {
    throw new Error(
      "TASK-021 requires the seeded local RUB region and default sales channel."
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
    throw new Error("TASK-021 requires a sellable canonical Medusa variant.");
  }

  return {
    regionId: region.id,
    salesChannelId: store.default_sales_channel_id,
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
    email: `task021_${suffix}@example.test`,
    first_name: "TASK-021",
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
  },
  customerId: string | null,
  items: Array<{ variantId: string; quantity: number }>
) {
  const cart = await cartModule.createCarts({
    currency_code: "rub",
    region_id: fixture.regionId,
    sales_channel_id: fixture.salesChannelId,
    shipping_address: {
      first_name: "TASK-021",
      last_name: "Merge API",
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
  return {
    statusCode: res.statusCode,
    body: res.body,
  };
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

function assertError(
  result: RouteResult,
  statusCode: number,
  code: string
) {
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

async function cleanup(
  cartModule: ICartModuleService,
  customerModule: ICustomerModuleService,
  mergeService: CartMergeModuleService,
  cartIds: string[],
  customerIds: string[],
  sourceCartIds: string[]
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
}
