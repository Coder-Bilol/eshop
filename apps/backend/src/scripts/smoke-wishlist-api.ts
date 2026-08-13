import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type {
  ExecArgs,
  ICustomerModuleService,
} from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

import wishlistMiddlewares from "../api/middlewares";
import { GET } from "../api/store/wishlist/route";
import { POST } from "../api/store/wishlist/items/route";
import { DELETE } from "../api/store/wishlist/items/[product_id]/route";
import { WISHLIST_MODULE } from "../modules/wishlist";
import type WishlistModuleService from "../modules/wishlist/service";

const { loadCanonicalProducts } = require("../catalog/canonical") as {
  loadCanonicalProducts: (
    container: ExecArgs["container"],
    salesChannelId: string
  ) => Promise<any[]>;
};

type RouteResult = { statusCode: number; body: any };

export default async function smokeWishlistApi({ container }: ExecArgs) {
  const customerModule = container.resolve<ICustomerModuleService>(
    Modules.CUSTOMER
  );
  const wishlistService = container.resolve<WishlistModuleService>(
    WISHLIST_MODULE
  );
  const customerIds: string[] = [];
  const salesChannelId = await defaultSalesChannelId(container);
  const products = await loadCanonicalProducts(container, salesChannelId);
  const visible = products.find(
    (product) =>
      product.status === "published" && product.category?.is_active === true
  );
  assert.ok(visible?.id, "A visible canonical product is required.");

  const customerA = await createCustomer(customerModule, customerIds, "a");
  const customerB = await createCustomer(customerModule, customerIds, "b");
  const requestContext = {
    sales_channel_ids: [salesChannelId],
  };
  const assertions = {
    middlewareRegistered: false,
    guestDenied: false,
    exactProjection: false,
    duplicateAddIdempotent: false,
    customerIsolation: false,
    removeIdempotent: false,
    invalidRequestStable: false,
    hiddenProductNonDisclosure: false,
  };
  const credentialBoundary = assertCredentialBoundary();

  try {
    assertWishlistMiddleware();
    assertions.middlewareRegistered = true;

    for (const request of [
      () => listWishlist(container, requestContext, null),
      () => addWishlist(container, requestContext, null, { product_id: visible.id }),
      () => removeWishlist(container, requestContext, null, visible.id),
    ]) {
      assertError(await request(), 401, "wishlist_auth_required");
    }
    assertions.guestDenied = true;

    const first = await addWishlist(
      container,
      requestContext,
      customerA.id,
      { product_id: visible.id }
    );
    assert.equal(first.statusCode, 201);
    assert.equal(first.body.created, true);
    assertExactItem(first.body.item);

    const listed = await listWishlist(
      container,
      requestContext,
      customerA.id
    );
    assert.equal(listed.statusCode, 200);
    assert.equal(listed.body.count, 1);
    assert.deepEqual(listed.body.items[0], first.body.item);
    assertions.exactProjection = true;

    const duplicate = await addWishlist(
      container,
      requestContext,
      customerA.id,
      { product_id: visible.id }
    );
    assert.equal(duplicate.statusCode, 200);
    assert.equal(duplicate.body.created, false);
    assert.deepEqual(duplicate.body.item, first.body.item);
    assertions.duplicateAddIdempotent = true;

    const foreignList = await listWishlist(
      container,
      requestContext,
      customerB.id
    );
    assert.deepEqual(foreignList.body, { items: [], count: 0 });
    const foreignRemove = await removeWishlist(
      container,
      requestContext,
      customerB.id,
      visible.id
    );
    assert.deepEqual(foreignRemove.body, {
      product_id: visible.id,
      removed: false,
    });
    assertions.customerIsolation = true;

    const invalid = await addWishlist(
      container,
      requestContext,
      customerA.id,
      { product_id: visible.id, customer_id: customerB.id }
    );
    assertError(invalid, 400, "wishlist_invalid_request");
    const empty = await addWishlist(
      container,
      requestContext,
      customerA.id,
      {}
    );
    assertError(empty, 400, "wishlist_invalid_request");
    assertions.invalidRequestStable = true;

    const missing = await addWishlist(
      container,
      requestContext,
      customerA.id,
      { product_id: "prod_missing_task038" }
    );
    assertError(missing, 404, "wishlist_product_not_found");
    assert.equal(missing.body.error.message, "Wishlist product was not found.");
    assert.deepEqual(missing.body.error.details, {});
    assertions.hiddenProductNonDisclosure = true;

    const removed = await removeWishlist(
      container,
      requestContext,
      customerA.id,
      visible.id
    );
    assert.deepEqual(removed.body, {
      product_id: visible.id,
      removed: true,
    });
    const repeatedRemove = await removeWishlist(
      container,
      requestContext,
      customerA.id,
      visible.id
    );
    assert.deepEqual(repeatedRemove.body, {
      product_id: visible.id,
      removed: false,
    });
    assertions.removeIdempotent = true;

    process.stdout.write(
      `${JSON.stringify(
        {
          suite: "wishlist-api",
          status: "ok",
          sourceBoundary: "medusa-route-workflow-module-postgresql",
          assertions,
          credentialBoundary,
        },
        null,
        2
      )}\n`
    );
  } finally {
    const rows = await wishlistService.listWishlistItems({
      customer_id: customerIds,
    });
    if (rows.length > 0) {
      await wishlistService.deleteWishlistItems(rows.map((row) => row.id));
    }
    for (const customerId of customerIds) {
      await customerModule.deleteCustomers(customerId).catch(() => undefined);
    }
  }
}

async function listWishlist(
  container: ExecArgs["container"],
  publishable_key_context: { sales_channel_ids: string[] },
  actorId: string | null
): Promise<RouteResult> {
  const res = new TestResponse();
  await GET(
    {
      scope: container,
      publishable_key_context,
      ...(actorId ? { auth_context: authContext(actorId) } : {}),
    } as any,
    res as any
  );
  return res.result();
}

async function addWishlist(
  container: ExecArgs["container"],
  publishable_key_context: { sales_channel_ids: string[] },
  actorId: string | null,
  body: Record<string, unknown>
): Promise<RouteResult> {
  const res = new TestResponse();
  await POST(
    {
      scope: container,
      body,
      validatedBody: body,
      publishable_key_context,
      ...(actorId ? { auth_context: authContext(actorId) } : {}),
    } as any,
    res as any
  );
  return res.result();
}

async function removeWishlist(
  container: ExecArgs["container"],
  publishable_key_context: { sales_channel_ids: string[] },
  actorId: string | null,
  productId: string
): Promise<RouteResult> {
  const res = new TestResponse();
  await DELETE(
    {
      scope: container,
      params: { product_id: productId },
      publishable_key_context,
      ...(actorId ? { auth_context: authContext(actorId) } : {}),
    } as any,
    res as any
  );
  return res.result();
}

function authContext(actorId: string) {
  return {
    actor_id: actorId,
    actor_type: "customer",
    auth_identity_id: `auth_identity_${actorId}`,
    app_metadata: {},
    user_metadata: {},
  };
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
    assert.ok(route, `Missing middleware for ${matcher}`);
    assert.deepEqual(route.method ?? route.methods, methods);
    assert.equal(route.middlewares?.length, 1);
  }
}

function assertCredentialBoundary() {
  const repositoryRoot = path.resolve(process.cwd(), "..", "..");
  const middlewareSource = fs.readFileSync(
    path.join(repositoryRoot, "apps/backend/src/api/middlewares.ts"),
    "utf8"
  );
  const storefrontAuthSource = fs.readFileSync(
    path.join(repositoryRoot, "apps/storefront/lib/auth.ts"),
    "utf8"
  );
  const storefrontCartSource = fs.readFileSync(
    path.join(repositoryRoot, "apps/storefront/lib/cart-merge.ts"),
    "utf8"
  );
  const existingHarnessSource = fs.readFileSync(
    path.join(repositoryRoot, "apps/storefront/e2e/run-real-medusa-e2e.cjs"),
    "utf8"
  );

  const wishlistAuthRegistrations = [
    "/store/wishlist",
    "/store/wishlist/items",
    "/store/wishlist/items/:product_id",
  ];
  for (const matcher of wishlistAuthRegistrations) {
    const escapedMatcher = matcher.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(
      middlewareSource,
      new RegExp(
        `matcher: "${escapedMatcher}"[\\s\\S]{0,220}authenticate\\("customer", \\["session", "bearer"\\]\\)`
      )
    );
  }

  assert.match(storefrontAuthSource, /credentials:\s*["']include["']/);
  assert.match(storefrontCartSource, /credentials:\s*["']include["']/);
  assert.doesNotMatch(storefrontAuthSource, /["']authorization["']|Bearer\s+/i);
  assert.doesNotMatch(storefrontCartSource, /["']authorization["']|Bearer\s+/i);
  assert.match(existingHarnessSource, /authorization:\s*`Bearer \$\{[^}]+\}`/);
  assert.equal(
    existingHarnessSource.includes("/\\/store\\/carts\\/[^/]+\\/merge$/"),
    true
  );

  return {
    productionStorefrontCredential: "session-cookie",
    localHarnessBearerTransport: "existing-cart-merge-e2e-through-standard-medusa-middleware",
    wishlistMiddlewareCredentialMethods: ["session", "bearer"],
  };
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
  assert.equal(item.product.id, item.product_id);
  assert.equal(typeof item.product.is_available, "boolean");
}

function assertError(result: RouteResult, statusCode: number, code: string) {
  assert.equal(result.statusCode, statusCode);
  assert.equal(result.body.error.code, code);
  assert.equal(typeof result.body.error.message, "string");
  assert.deepEqual(result.body.error.details, {});
}

async function defaultSalesChannelId(container: ExecArgs["container"]) {
  const storeModule = container.resolve(Modules.STORE) as any;
  const [store] = await storeModule.listStores();
  assert.ok(store?.default_sales_channel_id, "Default sales channel is missing.");
  return store.default_sales_channel_id as string;
}

async function createCustomer(
  customerModule: ICustomerModuleService,
  createdCustomerIds: string[],
  label: string
) {
  const suffix = `${process.pid}_${Date.now()}_${label}`;
  const customer = await customerModule.createCustomers({
    email: `task038_${suffix}@example.test`,
    first_name: "TASK-038",
    last_name: label,
    has_account: true,
  });
  createdCustomerIds.push(customer.id);
  return customer;
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
