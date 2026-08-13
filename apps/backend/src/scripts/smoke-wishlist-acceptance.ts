import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type {
  ExecArgs,
  ICustomerModuleService,
} from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  deleteProductCategoriesWorkflow,
  deleteProductsWorkflow,
  updateInventoryLevelsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows";

import wishlistMiddlewares from "../api/middlewares";
import { GET } from "../api/store/wishlist/route";
import { POST } from "../api/store/wishlist/items/route";
import { DELETE } from "../api/store/wishlist/items/[product_id]/route";
import { WISHLIST_MODULE } from "../modules/wishlist";
import type WishlistModuleService from "../modules/wishlist/service";

const phase = process.env.WISHLIST_ACCEPTANCE_PHASE ?? "full";
const runId =
  process.env.WISHLIST_ACCEPTANCE_RUN_ID ??
  `task041${process.pid.toString(36)}${Date.now().toString(36)}`;
const browserCustomerId =
  process.env.WISHLIST_ACCEPTANCE_BROWSER_CUSTOMER_ID?.trim() || null;
const publishableApiKey =
  process.env.WISHLIST_ACCEPTANCE_PUBLISHABLE_API_KEY?.trim() || null;
const stateFile =
  process.env.WISHLIST_ACCEPTANCE_STATE_FILE ??
  path.join(os.tmpdir(), `${runId}-wishlist-acceptance-state.json`);

type ProductRole =
  | "visible"
  | "unpublished"
  | "channelInvisible"
  | "inactiveCategory"
  | "restorable"
  | "outOfStock";

type AcceptanceState = {
  runId: string;
  salesChannelId: string;
  salesChannelSource: "publishable-key-query" | "default-store-fallback";
  customerIds: [string, string];
  categoryIds: string[];
  productIds: Record<ProductRole, string>;
  productHandles?: Partial<Record<ProductRole, string>>;
  browserCustomerId?: string;
  missingProductId: string;
};

type RouteResult = {
  statusCode: number;
  body: any;
};

export default async function smokeWishlistAcceptance({
  container,
}: ExecArgs) {
  assertLocalBoundary();

  if (!["write", "read", "browser-setup", "cleanup", "full"].includes(phase)) {
    throw new Error(`Unsupported wishlist acceptance phase: ${phase}`);
  }

  if (phase === "write") {
    const state = await createFixtures(container);
    writeState(state);
    await seedDurableFavorite(container, state);
    writeResult("write", {
      durableFavoriteSeeded: true,
      syntheticCustomers: 2,
      syntheticProducts: Object.keys(state.productIds).length,
      salesChannelResolution: state.salesChannelSource,
      fixtureSalesChannelAligned: true,
      nextPhase: "fresh-process-read",
    });
    return;
  }

  if (phase === "read") {
    const state = readState();
    await assertPublishableKeyChannel(container, state);
    await runAcceptance(container, state);
    writeResult("read", {
      freshProcess: true,
      sourceBoundary: "medusa-store-routes-workflows-module-postgresql",
      salesChannelResolution: state.salesChannelSource,
      fixtureSalesChannelAligned: true,
      productionData: false,
    });
    return;
  }

  if (phase === "browser-setup") {
    const state = readState();
    await assertPublishableKeyChannel(container, state);
    const retained = await setupBrowserRetention(container, state);
    writeResult("browser-setup", {
      browserCustomerBound: true,
      retainedRows: retained.retainedRows,
      browserFixtures: retained.browserFixtures,
      salesChannelResolution: state.salesChannelSource,
      fixtureSalesChannelAligned: true,
      productionData: false,
    });
    return;
  }

  if (phase === "cleanup") {
    if (!fs.existsSync(stateFile)) {
      writeResult("cleanup", { stateFound: false, cleanupComplete: true });
      return;
    }
    await cleanupFixtures(container, readState());
    fs.rmSync(stateFile, { force: true });
    writeResult("cleanup", { stateFound: true, cleanupComplete: true });
    return;
  }

  const state = await createFixtures(container);
  writeState(state);
  try {
    await seedDurableFavorite(container, state);
    await runAcceptance(container, state);
  } finally {
    await cleanupFixtures(container, state);
    fs.rmSync(stateFile, { force: true });
  }
  writeResult("full", {
    freshProcess: false,
    sourceBoundary: "medusa-store-routes-workflows-module-postgresql",
    productionData: false,
  });
}

async function createFixtures(
  container: ExecArgs["container"]
): Promise<AcceptanceState> {
  const storeModule = container.resolve(Modules.STORE) as any;
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT) as any;
  const customerModule = container.resolve<ICustomerModuleService>(
    Modules.CUSTOMER
  );
  const [store] = await storeModule.listStores();
  const [shippingProfile] = await fulfillmentModule.listShippingProfiles({
    type: "default",
  });
  assert.ok(shippingProfile?.id, "Default shipping profile is missing.");
  const salesChannel = await resolveAcceptanceSalesChannel(container, store);

  const categoryDefinitions = [
    { role: "active", is_active: true },
    { role: "inactive", is_active: false },
  ];
  const { result: categories } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: categoryDefinitions.map(({ role, is_active }) => ({
        handle: `task041-${runId}-${role}`,
        name: `TASK-041 ${role} synthetic category`,
        is_active,
      })),
    },
  });
  const activeCategoryId = categories[0]?.id;
  const inactiveCategoryId = categories[1]?.id;
  assert.ok(activeCategoryId);
  assert.ok(inactiveCategoryId);

  const productDefinitions: Array<{
    role: ProductRole;
    categoryId: string;
    status: ProductStatus;
    sales_channels: Array<{ id: string }>;
  }> = [
    {
      role: "visible",
      categoryId: activeCategoryId,
      status: ProductStatus.PUBLISHED,
      sales_channels: [{ id: salesChannel.id }],
    },
    {
      role: "unpublished",
      categoryId: activeCategoryId,
      status: ProductStatus.DRAFT,
      sales_channels: [{ id: salesChannel.id }],
    },
    {
      role: "channelInvisible",
      categoryId: activeCategoryId,
      status: ProductStatus.PUBLISHED,
      sales_channels: [],
    },
    {
      role: "inactiveCategory",
      categoryId: inactiveCategoryId,
      status: ProductStatus.PUBLISHED,
      sales_channels: [{ id: salesChannel.id }],
    },
    {
      role: "restorable",
      categoryId: activeCategoryId,
      status: ProductStatus.DRAFT,
      sales_channels: [{ id: salesChannel.id }],
    },
    {
      role: "outOfStock",
      categoryId: activeCategoryId,
      status: ProductStatus.PUBLISHED,
      sales_channels: [{ id: salesChannel.id }],
    },
  ];
  const { result: products } = await createProductsWorkflow(container).run({
    input: {
      products: productDefinitions.map((definition) => ({
        title: `TASK-041 ${definition.role} synthetic product`,
        handle: `task041-${runId}-${slug(definition.role)}`,
        description: "Synthetic local acceptance fixture.",
        status: definition.status,
        category_ids: [definition.categoryId],
        shipping_profile_id: shippingProfile.id,
        sales_channels: definition.sales_channels,
        metadata: {
          task041_acceptance: runId,
          task041_role: definition.role,
        },
        options: [{ title: "Default", values: ["Default"] }],
        variants: [
          {
            title: "Default",
            sku: `task041-${runId}-${definition.role}`,
            manage_inventory: true,
            allow_backorder: false,
            options: { Default: "Default" },
            prices: [{ amount: 4100, currency_code: "rub" }],
          },
        ],
      })),
    },
  });
  assert.equal(products.length, productDefinitions.length);

  const productIds = Object.fromEntries(
    productDefinitions.map((definition, index) => [
      definition.role,
      String(products[index].id),
    ])
  ) as Record<ProductRole, string>;
  const productHandles = Object.fromEntries(
    productDefinitions.map((definition, index) => [
      definition.role,
      String(products[index].handle),
    ])
  ) as Record<ProductRole, string>;
  await makeOutOfStock(container, productIds.outOfStock);

  const customers = [
    await createCustomer(customerModule, "a"),
    await createCustomer(customerModule, "b"),
  ] as [any, any];

  return {
    runId,
    salesChannelId: salesChannel.id,
    salesChannelSource: salesChannel.source,
    customerIds: [customers[0].id, customers[1].id],
    categoryIds: categories.map((category) => String(category.id)),
    productIds,
    productHandles,
    missingProductId: `prod_task041_${runId}_missing`,
  };
}

async function resolveAcceptanceSalesChannel(
  container: ExecArgs["container"],
  store: any
) {
  if (!publishableApiKey) {
    assert.ok(store?.default_sales_channel_id, "Default sales channel is missing.");
    return {
      id: String(store.default_sales_channel_id),
      source: "default-store-fallback" as const,
    };
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any;
  const { data: apiKeys } = await query.graph({
    entity: "api_key",
    fields: ["id", "token", "type", "sales_channels.id"],
    filters: { token: publishableApiKey },
  });
  const apiKey = (apiKeys || []).find(
    (candidate: any) =>
      candidate.token === publishableApiKey && candidate.type === "publishable"
  );
  assert.ok(apiKey, "The acceptance publishable key was not resolved locally.");

  const salesChannelIds = Array.from(
    new Set(
      (apiKey.sales_channels || [])
        .map((channel: any) => String(channel.id || ""))
        .filter(Boolean)
    )
  ) as string[];
  assert.ok(
    salesChannelIds[0],
    "The acceptance publishable key has no selected sales channel."
  );

  return {
    id: salesChannelIds[0],
    source: "publishable-key-query" as const,
  };
}

async function assertPublishableKeyChannel(
  container: ExecArgs["container"],
  state: AcceptanceState
) {
  if (!publishableApiKey) return;

  const resolved = await resolveAcceptanceSalesChannel(container, null);
  assert.equal(
    resolved.id,
    state.salesChannelId,
    "The publishable key sales channel changed during acceptance."
  );
  assert.equal(resolved.source, "publishable-key-query");
}

async function setupBrowserRetention(
  container: ExecArgs["container"],
  state: AcceptanceState
) {
  assert.ok(
    browserCustomerId,
    "WISHLIST_ACCEPTANCE_BROWSER_CUSTOMER_ID is required for browser setup."
  );
  assert.equal(
    state.customerIds.includes(browserCustomerId),
    false,
    "Browser customer must be distinct from the backend acceptance customers."
  );
  await assertSyntheticBrowserCustomer(container, browserCustomerId);

  const browserState: AcceptanceState = {
    ...state,
    browserCustomerId,
  };
  writeState(browserState);

  const wishlistService = container.resolve<WishlistModuleService>(
    WISHLIST_MODULE
  );
  const hiddenProductIds = [
    state.missingProductId,
    state.productIds.unpublished,
    state.productIds.channelInvisible,
    state.productIds.inactiveCategory,
  ];
  const hiddenRows = [];
  for (const productId of hiddenProductIds) {
    hiddenRows.push(
      await wishlistService.createWishlistItems({
        customer_id: browserCustomerId,
        product_id: productId,
      })
    );
  }

  const restoredRow = await wishlistService.createWishlistItems({
    customer_id: browserCustomerId,
    product_id: state.productIds.restorable,
  });
  await updateProductsWorkflow(container).run({
    input: {
      products: [
        {
          id: state.productIds.restorable,
          status: ProductStatus.PUBLISHED,
        },
      ],
    },
  });

  const outOfStockRow = await wishlistService.createWishlistItems({
    customer_id: browserCustomerId,
    product_id: state.productIds.outOfStock,
  });
  const retainedRows = await wishlistService.listWishlistItems({
    customer_id: browserCustomerId,
  });
  assert.equal(retainedRows.length, hiddenProductIds.length + 2);
  const listed = await listWishlist(
    container,
    browserState,
    browserCustomerId
  );
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.body.count, 2);
  assert.equal(
    listed.body.items.some((item: any) =>
      hiddenProductIds.includes(item.product_id)
    ),
    false
  );
  const restoredItem = listed.body.items.find(
    (item: any) => item.product_id === state.productIds.restorable
  );
  const outOfStockItem = listed.body.items.find(
    (item: any) => item.product_id === state.productIds.outOfStock
  );
  assert.equal(restoredItem?.id, restoredRow.id);
  assert.equal(outOfStockItem?.id, outOfStockRow.id);
  assert.equal(outOfStockItem?.product.is_available, false);
  const restoredHandle = state.productHandles?.restorable;
  const outOfStockHandle = state.productHandles?.outOfStock;
  assert.ok(restoredHandle);
  assert.ok(outOfStockHandle);

  return {
    retainedRows: {
      hidden: hiddenRows.length,
      restored: 1,
      outOfStock: 1,
    },
    browserFixtures: {
      hiddenProductIds,
      restored: {
        productId: state.productIds.restorable,
        handle: restoredHandle,
      },
      outOfStock: {
        productId: state.productIds.outOfStock,
        handle: outOfStockHandle,
      },
    },
  };
}

async function seedDurableFavorite(
  container: ExecArgs["container"],
  state: AcceptanceState
) {
  const result = await addWishlist(
    container,
    state,
    state.customerIds[0],
    { product_id: state.productIds.visible }
  );
  assert.equal(result.statusCode, 201);
  assert.equal(result.body.created, true);
  assertExactItem(result.body.item);
}

async function runAcceptance(
  container: ExecArgs["container"],
  state: AcceptanceState
) {
  const assertions = {
    freshProcessDurabilityAndStoreRemoval: false,
    twoCustomerIsolation: false,
    duplicateAndConcurrentAdd: false,
    repeatedRemove: false,
    guestDenial: false,
    malformedInput: false,
    exactProjection: false,
    backendFailureSanitized: false,
    hidden404AndListOmission: false,
    visibilityRestoration: false,
    outOfStockVisibleUnavailable: false,
  };

  assertWishlistMiddleware();
  await assertFreshProcessDurabilityAndRemoval(container, state);
  assertions.freshProcessDurabilityAndStoreRemoval = true;

  await assertGuestDenial(container, state);
  assertions.guestDenial = true;

  await assertMalformedInput(container, state);
  assertions.malformedInput = true;

  await assertOwnershipAndConcurrency(container, state);
  assertions.twoCustomerIsolation = true;
  assertions.duplicateAndConcurrentAdd = true;
  assertions.repeatedRemove = true;
  assertions.exactProjection = true;

  await assertBackendFailure(container, state);
  assertions.backendFailureSanitized = true;

  await assertHiddenProducts(container, state);
  assertions.hidden404AndListOmission = true;

  await assertVisibilityRestoration(container, state);
  assertions.visibilityRestoration = true;

  await assertOutOfStock(container, state);
  assertions.outOfStockVisibleUnavailable = true;

  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "wishlist-acceptance",
        phase: "read",
        status: "ok",
        sourceBoundary: "medusa-store-routes-workflows-module-postgresql",
        assertions,
        evidencePrivacy: "synthetic-local-coarse-assertions-only",
        productionData: false,
      },
      null,
      2
    )}\n`
  );
}

async function assertFreshProcessDurabilityAndRemoval(
  container: ExecArgs["container"],
  state: AcceptanceState
) {
  const customer = await retrieveCustomer(container, state.customerIds[0]);
  assert.equal(customer.id, state.customerIds[0]);

  const listed = await listWishlist(container, state, state.customerIds[0]);
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.body.count, 1);
  assertExactItem(listed.body.items[0]);
  assert.equal(listed.body.items[0].product_id, state.productIds.visible);

  const removed = await removeWishlist(
    container,
    state,
    state.customerIds[0],
    state.productIds.visible
  );
  assert.deepEqual(removed.body, {
    product_id: state.productIds.visible,
    removed: true,
  });

  const afterRemoval = await listWishlist(
    container,
    state,
    state.customerIds[0]
  );
  assert.deepEqual(afterRemoval.body, { items: [], count: 0 });
}

async function assertGuestDenial(
  container: ExecArgs["container"],
  state: AcceptanceState
) {
  assertError(
    await listWishlist(container, state, null),
    401,
    "wishlist_auth_required"
  );
  assertError(
    await addWishlist(container, state, null, {
      product_id: state.productIds.visible,
    }),
    401,
    "wishlist_auth_required"
  );
  assertError(
    await removeWishlist(
      container,
      state,
      null,
      state.productIds.visible
    ),
    401,
    "wishlist_auth_required"
  );
}

async function assertMalformedInput(
  container: ExecArgs["container"],
  state: AcceptanceState
) {
  assertError(
    await addWishlist(container, state, state.customerIds[0], {}),
    400,
    "wishlist_invalid_request"
  );
  assertError(
    await addWishlist(container, state, state.customerIds[0], {
      product_id: " ",
    }),
    400,
    "wishlist_invalid_request"
  );
  assertError(
    await addWishlist(container, state, state.customerIds[0], {
      product_id: state.productIds.visible,
      customer_id: state.customerIds[1],
    }),
    400,
    "wishlist_invalid_request"
  );
  assertError(
    await removeWishlist(container, state, state.customerIds[0], undefined),
    400,
    "wishlist_invalid_request"
  );
}

async function assertOwnershipAndConcurrency(
  container: ExecArgs["container"],
  state: AcceptanceState
) {
  const first = await addWishlist(
    container,
    state,
    state.customerIds[0],
    { product_id: state.productIds.visible }
  );
  assert.equal(first.statusCode, 201);
  assert.equal(first.body.created, true);
  assertExactItem(first.body.item);

  const duplicate = await addWishlist(
    container,
    state,
    state.customerIds[0],
    { product_id: state.productIds.visible }
  );
  assert.equal(duplicate.statusCode, 200);
  assert.equal(duplicate.body.created, false);
  assert.deepEqual(duplicate.body.item, first.body.item);

  const concurrent = await Promise.all([
    addWishlist(container, state, state.customerIds[0], {
      product_id: state.productIds.outOfStock,
    }),
    addWishlist(container, state, state.customerIds[0], {
      product_id: state.productIds.outOfStock,
    }),
  ]);
  assert.equal(concurrent.filter((result) => result.statusCode === 201).length, 1);
  assert.equal(concurrent.filter((result) => result.statusCode === 200).length, 1);
  assert.equal(
    concurrent.filter((result) => result.body.created === true).length,
    1
  );
  assert.equal(
    (
      await listWishlist(container, state, state.customerIds[0])
    ).body.items.filter(
      (item: any) => item.product_id === state.productIds.outOfStock
    ).length,
    1
  );

  const foreignList = await listWishlist(
    container,
    state,
    state.customerIds[1]
  );
  assert.deepEqual(foreignList.body, { items: [], count: 0 });
  const foreignRemove = await removeWishlist(
    container,
    state,
    state.customerIds[1],
    state.productIds.visible
  );
  assert.deepEqual(foreignRemove.body, {
    product_id: state.productIds.visible,
    removed: false,
  });

  const secondCustomerAdd = await addWishlist(
    container,
    state,
    state.customerIds[1],
    { product_id: state.productIds.visible }
  );
  assert.equal(secondCustomerAdd.statusCode, 201);
  assert.equal(secondCustomerAdd.body.created, true);

  const firstCustomerList = await listWishlist(
    container,
    state,
    state.customerIds[0]
  );
  const secondCustomerList = await listWishlist(
    container,
    state,
    state.customerIds[1]
  );
  assert.equal(
    firstCustomerList.body.items.filter(
      (item: any) => item.product_id === state.productIds.visible
    ).length,
    1
  );
  assert.equal(secondCustomerList.body.count, 1);
  assert.notEqual(
    firstCustomerList.body.items.find(
      (item: any) => item.product_id === state.productIds.visible
    ).id,
    secondCustomerList.body.items[0].id
  );

  const firstRemove = await removeWishlist(
    container,
    state,
    state.customerIds[0],
    state.productIds.visible
  );
  assert.deepEqual(firstRemove.body, {
    product_id: state.productIds.visible,
    removed: true,
  });
  assert.equal((await listWishlist(container, state, state.customerIds[1])).body.count, 1);

  const secondRemove = await removeWishlist(
    container,
    state,
    state.customerIds[1],
    state.productIds.visible
  );
  assert.deepEqual(secondRemove.body, {
    product_id: state.productIds.visible,
    removed: true,
  });
  const repeatedRemove = await removeWishlist(
    container,
    state,
    state.customerIds[1],
    state.productIds.visible
  );
  assert.deepEqual(repeatedRemove.body, {
    product_id: state.productIds.visible,
    removed: false,
  });

  const outOfStockRemove = await removeWishlist(
    container,
    state,
    state.customerIds[0],
    state.productIds.outOfStock
  );
  assert.deepEqual(outOfStockRemove.body, {
    product_id: state.productIds.outOfStock,
    removed: true,
  });
}

async function assertBackendFailure(
  container: ExecArgs["container"],
  state: AcceptanceState
) {
  const marker = "synthetic backend failure marker";
  const failingScope = {
    resolve() {
      throw new Error(marker);
    },
  };
  const listFailure = await listWishlist(
    container,
    state,
    state.customerIds[0],
    failingScope
  );
  assertError(listFailure, 500, "wishlist_operation_failed");
  assert.equal(JSON.stringify(listFailure.body).includes(marker), false);

  const addFailure = await addWishlist(
    container,
    state,
    state.customerIds[0],
    { product_id: state.productIds.visible },
    failingScope
  );
  assertError(addFailure, 500, "wishlist_operation_failed");
  assert.equal(JSON.stringify(addFailure.body).includes(marker), false);
}

async function assertHiddenProducts(
  container: ExecArgs["container"],
  state: AcceptanceState
) {
  const hiddenProducts = [
    state.missingProductId,
    state.productIds.unpublished,
    state.productIds.channelInvisible,
    state.productIds.inactiveCategory,
  ];
  let signature: string | undefined;
  const service = container.resolve<WishlistModuleService>(WISHLIST_MODULE);

  for (const productId of hiddenProducts) {
    const addResult = await addWishlist(
      container,
      state,
      state.customerIds[0],
      { product_id: productId }
    );
    assertError(addResult, 404, "wishlist_product_not_found");
    const currentSignature = errorSignature(addResult);
    signature ??= currentSignature;
    assert.equal(currentSignature, signature);

    const row = await service.createWishlistItems({
      customer_id: state.customerIds[0],
      product_id: productId,
    });
    const listed = await listWishlist(container, state, state.customerIds[0]);
    assert.equal(listed.statusCode, 200);
    assert.equal(listed.body.count, 0);
    assert.equal(
      listed.body.items.some((item: any) => item.id === row.id),
      false
    );
    await service.deleteWishlistItems(row.id);
  }
}

async function assertVisibilityRestoration(
  container: ExecArgs["container"],
  state: AcceptanceState
) {
  const service = container.resolve<WishlistModuleService>(WISHLIST_MODULE);
  const row = await service.createWishlistItems({
    customer_id: state.customerIds[0],
    product_id: state.productIds.restorable,
  });
  const hidden = await listWishlist(container, state, state.customerIds[0]);
  assert.deepEqual(hidden.body, { items: [], count: 0 });

  await updateProductsWorkflow(container).run({
    input: {
      products: [
        {
          id: state.productIds.restorable,
          status: ProductStatus.PUBLISHED,
        },
      ],
    },
  });
  const restored = await listWishlist(container, state, state.customerIds[0]);
  assert.equal(restored.body.count, 1);
  assert.equal(restored.body.items[0].id, row.id);
  assert.equal(restored.body.items[0].product.id, state.productIds.restorable);

  const removed = await removeWishlist(
    container,
    state,
    state.customerIds[0],
    state.productIds.restorable
  );
  assert.deepEqual(removed.body, {
    product_id: state.productIds.restorable,
    removed: true,
  });
}

async function assertOutOfStock(
  container: ExecArgs["container"],
  state: AcceptanceState
) {
  const addResult = await addWishlist(
    container,
    state,
    state.customerIds[0],
    { product_id: state.productIds.outOfStock }
  );
  assert.equal(addResult.statusCode, 201);
  assert.equal(addResult.body.created, true);
  assertExactItem(addResult.body.item);
  assert.equal(addResult.body.item.product.is_available, false);

  const listed = await listWishlist(container, state, state.customerIds[0]);
  assert.equal(listed.body.count, 1);
  assert.equal(listed.body.items[0].product.is_available, false);
  assert.equal(listed.body.items[0].product.id, state.productIds.outOfStock);
  assert.deepEqual(listed.body.items[0], addResult.body.item);

  const removed = await removeWishlist(
    container,
    state,
    state.customerIds[0],
    state.productIds.outOfStock
  );
  assert.deepEqual(removed.body, {
    product_id: state.productIds.outOfStock,
    removed: true,
  });
}

async function listWishlist(
  container: ExecArgs["container"],
  state: AcceptanceState,
  actorId: string | null,
  scope: unknown = container
): Promise<RouteResult> {
  const response = new TestResponse();
  await GET(
    {
      scope,
      publishable_key_context: { sales_channel_ids: [state.salesChannelId] },
      ...(actorId ? { auth_context: authContext(actorId) } : {}),
    } as any,
    response as any
  );
  return response.result();
}

async function addWishlist(
  container: ExecArgs["container"],
  state: AcceptanceState,
  actorId: string | null,
  body: Record<string, unknown>,
  scope: unknown = container
): Promise<RouteResult> {
  const response = new TestResponse();
  await POST(
    {
      scope,
      body,
      validatedBody: body,
      publishable_key_context: { sales_channel_ids: [state.salesChannelId] },
      ...(actorId ? { auth_context: authContext(actorId) } : {}),
    } as any,
    response as any
  );
  return response.result();
}

async function removeWishlist(
  container: ExecArgs["container"],
  state: AcceptanceState,
  actorId: string | null,
  productId: string | undefined,
  scope: unknown = container
): Promise<RouteResult> {
  const response = new TestResponse();
  await DELETE(
    {
      scope,
      params: { product_id: productId },
      publishable_key_context: { sales_channel_ids: [state.salesChannelId] },
      ...(actorId ? { auth_context: authContext(actorId) } : {}),
    } as any,
    response as any
  );
  return response.result();
}

function assertWishlistMiddleware() {
  const routes = wishlistMiddlewares.routes || [];
  const expected = [
    ["/store/wishlist", ["GET"]],
    ["/store/wishlist/items", ["POST"]],
    ["/store/wishlist/items/:product_id", ["DELETE"]],
  ];
  for (const [matcher, methods] of expected) {
    const route = routes.find((candidate) => candidate.matcher === matcher);
    assert.ok(route, `Missing wishlist middleware for ${matcher}`);
    assert.deepEqual(route.method ?? route.methods, methods);
    assert.equal(route.middlewares?.length, 1);
  }
}

function assertExactItem(item: any) {
  assert.deepEqual(Object.keys(item).sort(), [
    "created_at",
    "id",
    "product",
    "product_id",
  ]);
  assert.deepEqual(Object.keys(item.product).sort(), [
    "category",
    "handle",
    "id",
    "is_available",
    "price",
    "thumbnail",
    "title",
  ]);
  assert.deepEqual(Object.keys(item.product.category).sort(), [
    "handle",
    "name",
  ]);
  if (item.product.price !== null) {
    assert.deepEqual(Object.keys(item.product.price).sort(), [
      "amount",
      "currency_code",
    ]);
    assert.equal(Number.isInteger(item.product.price.amount), true);
  }
  assert.equal(item.product.id, item.product_id);
  assert.equal(typeof item.product.handle, "string");
  assert.equal(typeof item.product.title, "string");
  assert.equal(typeof item.product.is_available, "boolean");
}

function assertError(result: RouteResult, statusCode: number, code: string) {
  assert.equal(result.statusCode, statusCode);
  assert.deepEqual(Object.keys(result.body).sort(), ["error"]);
  assert.equal(result.body.error.code, code);
  assert.equal(typeof result.body.error.message, "string");
  assert.deepEqual(result.body.error.details, {});
}

function errorSignature(result: RouteResult) {
  return `${result.statusCode}:${result.body.error.code}:${result.body.error.message}:${JSON.stringify(result.body.error.details)}`;
}

function authContext(actorId: string) {
  return {
    actor_id: actorId,
    actor_type: "customer",
    auth_identity_id: `auth_identity_task041_${actorId}`,
    app_metadata: {},
    user_metadata: {},
  };
}

async function createCustomer(
  customerModule: ICustomerModuleService,
  label: string
) {
  return customerModule.createCustomers({
    email: `task041.${runId}.${label}@example.test`,
    first_name: "TASK-041",
    last_name: label,
    has_account: true,
  });
}

async function retrieveCustomer(
  container: ExecArgs["container"],
  customerId: string
) {
  const customerModule = container.resolve<ICustomerModuleService>(
    Modules.CUSTOMER
  );
  return customerModule.retrieveCustomer(customerId);
}

async function assertSyntheticBrowserCustomer(
  container: ExecArgs["container"],
  customerId: string
) {
  assert.match(customerId, /^cus_[A-Za-z0-9_-]+$/);
  const customer = await retrieveCustomer(container, customerId);
  assert.match(
    customer.email,
    /^task034\.(google|vkid)\.[A-Za-z0-9]+@example\.test$/,
    "Browser actor must be a synthetic local provider-double customer."
  );
}

async function makeOutOfStock(
  container: ExecArgs["container"],
  productId: string
) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any;
  const { data: links } = await query.graph({
    entity: "product_variant_inventory_items",
    fields: [
      "variant.id",
      "variant.product.id",
      "inventory_item_id",
      "inventory.location_levels.id",
      "inventory.location_levels.location_id",
    ],
  });
  const link = links.find(
    (candidate: any) => candidate.variant?.product?.id === productId
  );
  assert.ok(link, "Out-of-stock fixture inventory link is missing.");
  const levels = link.inventory?.location_levels || [];
  if (levels.length > 0) {
    await updateInventoryLevelsWorkflow(container).run({
      input: {
        updates: levels.map((level: any) => ({
          id: level.id,
          stocked_quantity: 0,
        })),
      },
    });
    return;
  }

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id"],
  });
  assert.ok(locations[0]?.id, "A local stock location is required.");
  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: [
        {
          location_id: locations[0].id,
          inventory_item_id: link.inventory_item_id,
          stocked_quantity: 0,
        },
      ],
    },
  });
}

async function cleanupFixtures(
  container: ExecArgs["container"],
  state: AcceptanceState
) {
  const wishlistService = container.resolve<WishlistModuleService>(
    WISHLIST_MODULE
  );
  const customerIds = [
    ...state.customerIds,
    ...(state.browserCustomerId ? [state.browserCustomerId] : []),
  ].filter((customerId, index, all) => all.indexOf(customerId) === index);
  for (const customerId of customerIds) {
    const rows = await wishlistService.listWishlistItems({
      customer_id: customerId,
    });
    if (rows.length > 0) {
      await wishlistService.deleteWishlistItems(rows.map((row) => row.id));
    }
  }

  const customerModule = container.resolve<ICustomerModuleService>(
    Modules.CUSTOMER
  );
  for (const customerId of customerIds) {
    await customerModule.deleteCustomers(customerId).catch(() => undefined);
  }
  await deleteProductsWorkflow(container).run({
    input: { ids: Object.values(state.productIds) },
  });
  await deleteProductCategoriesWorkflow(container).run({
    input: state.categoryIds,
  });
}

function assertLocalBoundary() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("TASK-041 acceptance is local-only and refuses production mode.");
  }
  if (!path.isAbsolute(stateFile)) {
    throw new Error("WISHLIST_ACCEPTANCE_STATE_FILE must be absolute.");
  }
}

function slug(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function writeState(state: AcceptanceState) {
  fs.writeFileSync(stateFile, `${JSON.stringify(state)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

function readState(): AcceptanceState {
  const state = JSON.parse(fs.readFileSync(stateFile, "utf8")) as AcceptanceState;
  assert.equal(state.runId, runId);
  assert.equal(state.customerIds.length, 2);
  assert.ok(state.salesChannelId);
  assert.ok(state.productIds.visible);
  return state;
}

function writeResult(phaseName: string, details: Record<string, unknown>) {
  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "wishlist-acceptance",
        phase: phaseName,
        status: "ok",
        evidencePrivacy: "synthetic-local-coarse-assertions-only",
        ...details,
      },
      null,
      2
    )}\n`
  );
}

class TestResponse {
  public statusCode = 200;
  public body: any;

  status(statusCode: number) {
    this.statusCode = statusCode;
    return this;
  }

  json(body: unknown) {
    this.body = body;
    return this;
  }

  result(): RouteResult {
    return { statusCode: this.statusCode, body: this.body };
  }
}
