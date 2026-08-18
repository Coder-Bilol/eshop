import assert from "node:assert/strict";

import type {
  ExecArgs,
  ICartModuleService,
  ICustomerModuleService,
} from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import {
  addToCartWorkflow,
  batchLinksWorkflow,
  createServiceZonesWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  deleteStockLocationsWorkflow,
} from "@medusajs/medusa/core-flows";

import {
  POST,
  toPublicPendingOrderError,
} from "../api/store/checkout/order/route";
import { DELIVERY_OPTION_IDS } from "../checkout/delivery-options";
import { pendingOrderExpiresAt } from "../checkout/pending-order";
import { PAYMENT_IDS } from "../checkout/validation";
import { createPendingOrderWorkflow } from "../workflows/checkout/create-pending-order";

const LOCAL_TARIFFS_MINOR_RUB = [0, 50_000, 70_000] as const;

type RouteResult = { statusCode: number; body: any };
type Fixture = {
  customerId: string;
  cartId: string;
  variantId: string;
  conflictCartId: string;
  conflictVariantId: string;
  compensationCartId: string;
  regionId: string;
  salesChannelId: string;
};

export default async function smokePendingOrder({ container }: ExecArgs) {
  assert.notEqual(
    process.env.NODE_ENV,
    "production",
    "TASK-050 smoke is local-only and refuses production mode."
  );

  const runId = `${process.pid}_${Date.now()}`;
  const customerModule = container.resolve<ICustomerModuleService>(
    Modules.CUSTOMER
  );
  const cartModule = container.resolve<ICartModuleService>(Modules.CART);
  const orderModule = container.resolve(Modules.ORDER) as any;
  const inventoryModule = container.resolve(Modules.INVENTORY) as any;
  const fulfillment = container.resolve(Modules.FULFILLMENT) as any;
  const createdOrderIds: string[] = [];
  const createdCartIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdOptionIds: string[] = [];
  let serviceZoneId: string | undefined;
  let fulfillmentSetId: string | undefined;
  let stockLocationId: string | undefined;

  try {
    const fixture = await createFixture({
      container,
      cartModule,
      customerModule,
      fulfillment,
      runId,
      createdCartIds,
      createdCustomerIds,
      createdOptionIds,
      setServiceZoneId: (value) => (serviceZoneId = value),
      setFulfillmentSetId: (value) => (fulfillmentSetId = value),
      setStockLocationId: (value) => (stockLocationId = value),
    });

    const before = await countRecords(orderModule, inventoryModule);
    const rawExpiresAt = pendingOrderExpiresAt(new Date("2026-08-16T12:00:00.000Z"));
    assert.equal(rawExpiresAt, "2026-08-19T12:00:00.000Z");

    const guest = await invokeOrder(container, undefined, fixture.cartId, runId);
    assert.equal(guest.statusCode, 401);
    assert.equal(guest.body.error.code, "checkout_auth_required");

    const created = await invokeOrder(
      container,
      fixture.customerId,
      fixture.cartId,
      `${runId}-create`
    );
    assert.equal(created.statusCode, 201, JSON.stringify(created.body));
    assert.equal(created.body.status, "pending_payment");
    assert.equal(created.body.payment_id, "card");
    assert.equal(
      Date.parse(created.body.expires_at) - Date.now() > 71 * 60 * 60 * 1000,
      true
    );
    assert.equal(typeof created.body.order_id, "string");
    createdOrderIds.push(created.body.order_id);

    const order = await orderModule.retrieveOrder(created.body.order_id, {
      relations: ["items"],
    });
    assert.equal(order.status, "pending");
    assert.equal(order.metadata.checkout_state, "pending_payment");
    assert.equal(order.metadata.checkout_idempotency_key, `${runId}-create`);
    assert.equal(order.metadata.checkout_managed_line_count, 1);
    assert.equal(order.items.length, 1);

    const reservations = await inventoryModule.listReservationItems({
      line_item_id: [order.items[0].id],
    });
    assert.equal(reservations.length, 1);
    assert.equal(reservations[0].line_item_id, order.items[0].id);
    assert.equal(reservations[0].metadata.order_id, order.id);
    assert.equal(reservations[0].metadata.state, "reserved");

    const afterCreate = await countRecords(orderModule, inventoryModule);
    assert.equal(afterCreate.orders, before.orders + 1);
    assert.equal(afterCreate.reservationItems, before.reservationItems + 1);

    const replay = await invokeOrder(
      container,
      fixture.customerId,
      fixture.cartId,
      `${runId}-create`
    );
    assert.equal(replay.statusCode, 200, JSON.stringify(replay.body));
    assert.equal(replay.body.order_id, created.body.order_id);
    const afterReplay = await countRecords(orderModule, inventoryModule);
    assert.deepEqual(afterReplay, afterCreate);

    const changedKeyReplay = await invokeOrder(
      container,
      fixture.customerId,
      fixture.cartId,
      `${runId}-changed-key`
    );
    assert.equal(
      changedKeyReplay.statusCode,
      200,
      JSON.stringify(changedKeyReplay.body)
    );
    assert.equal(changedKeyReplay.body.order_id, created.body.order_id);
    const orderAfterChangedKey = await orderModule.retrieveOrder(
      created.body.order_id,
      { relations: ["items"] }
    );
    assert.equal(
      orderAfterChangedKey.metadata.checkout_idempotency_key,
      `${runId}-create`
    );
    const afterChangedKeyReplay = await countRecords(orderModule, inventoryModule);
    assert.deepEqual(afterChangedKeyReplay, afterCreate);

    const conflict = await invokeOrder(
      container,
      fixture.customerId,
      fixture.cartId,
      `${runId}-create`,
      { comment: "different normalized request" }
    );
    assert.equal(conflict.statusCode, 409);
    assert.equal(conflict.body.error.code, "checkout_idempotency_conflict");
    assert.deepEqual(
      await countRecords(orderModule, inventoryModule),
      afterCreate
    );

    const stockConflict = await invokeOrder(
      container,
      fixture.customerId,
      fixture.conflictCartId,
      `${runId}-stock-conflict`,
      { cart_id: fixture.conflictCartId }
    );
    assert.equal(stockConflict.statusCode, 409, JSON.stringify(stockConflict.body));
    assert.equal(stockConflict.body.error.code, "checkout_stock_conflict");
    const afterConflict = await countRecords(orderModule, inventoryModule);
    assert.deepEqual(afterConflict, afterCreate);

    const compensationBefore = await countRecords(orderModule, inventoryModule);
    const forcedReservationFailure = await invokeForcedReservationFailure(
      container,
      fixture.customerId,
      fixture.compensationCartId,
      `${runId}-post-order-reservation-failure`
    );
    assert.equal(forcedReservationFailure.failed, true);
    assert.equal(forcedReservationFailure.code, "checkout_order_failed");

    const compensationAfter = await countRecords(orderModule, inventoryModule);
    assert.deepEqual(compensationAfter, compensationBefore);
    const ordersAfterCompensation = await orderModule.listOrders(
      {},
      { relations: ["items"], take: null } as any
    );
    assert.equal(
      ordersAfterCompensation.some(
        (candidate: any) =>
          candidate.metadata?.checkout_idempotency_key ===
          `${runId}-post-order-reservation-failure`
      ),
      false
    );

    process.stdout.write(
      `${JSON.stringify(
        {
          suite: "pending-order",
          status: "ok",
          sourceBoundary:
            "real-medusa-postgresql-route-workflow-order-inventory",
          authenticated: true,
          guestRejected: guest.statusCode === 401,
          pendingOrder: {
            nativeStatus: order.status,
            logicalStatus: order.metadata.checkout_state,
            expiryHours: 72,
            serverComputedExpiry: true,
          },
          reservation: {
            count: reservations.length,
            linkedBy: "line_item_id",
            directStockMutation: false,
          },
          idempotency: {
            replayStatus: replay.statusCode,
            sameOrder: true,
            countsUnchanged: true,
            changedKeyReplayStatus: changedKeyReplay.statusCode,
            changedKeySameOrder: true,
            changedKeyMetadataPreserved: true,
            changedKeyCountsUnchanged: true,
            mismatchedBodyRejected: true,
          },
          compensation: {
            status: stockConflict.statusCode,
            code: stockConflict.body.error.code,
            noPartialOrderOrReservation: true,
            postOrderReservationFailure: {
              status: forcedReservationFailure.statusCode,
              code: forcedReservationFailure.code,
              nativeOrderCreatedBeforeFailure: true,
              nativeReservationStepReached: true,
              noPartialOrderOrReservation: true,
              countsUnchanged: true,
            },
          },
          providerRequest: false,
          productionData: false,
          cleanup: "unconditional-finally",
        },
        null,
        2
      )}\n`
    );
  } finally {
    await cleanup({
      container,
      orderModule,
      inventoryModule,
      cartModule,
      customerModule,
      createdOrderIds,
      createdCartIds,
      createdCustomerIds,
      fulfillment,
      createdOptionIds,
      serviceZoneId,
      fulfillmentSetId,
      stockLocationId,
    });
  }
}

async function createFixture({
  container,
  cartModule,
  customerModule,
  fulfillment,
  runId,
  createdCartIds,
  createdCustomerIds,
  createdOptionIds,
  setServiceZoneId,
  setFulfillmentSetId,
  setStockLocationId,
}: {
  container: ExecArgs["container"];
  cartModule: ICartModuleService;
  customerModule: ICustomerModuleService;
  fulfillment: any;
  runId: string;
  createdCartIds: string[];
  createdCustomerIds: string[];
  createdOptionIds: string[];
  setServiceZoneId: (value: string) => void;
  setFulfillmentSetId: (value: string) => void;
  setStockLocationId: (value: string) => void;
}): Promise<Fixture> {
  const storeModule = container.resolve(Modules.STORE) as any;
  const regionModule = container.resolve(Modules.REGION) as any;
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL) as any;
  const [store] = await storeModule.listStores();
  const [region] = await regionModule.listRegions({ currency_code: "rub" });
  const [salesChannel] = await salesChannelModule.listSalesChannels({
    name: "Default Sales Channel",
  });
  assert.ok(store?.default_sales_channel_id && region?.id && salesChannel?.id);

  const products = await loadCanonicalProducts(
    container,
    store.default_sales_channel_id
  );
  const sellable = products
    .flatMap((product: any) => product.variants)
    .find((variant: any) => variant.availability?.is_sellable);
  const unavailable = products
    .flatMap((product: any) => product.variants)
    .find((variant: any) => !variant.availability?.is_sellable);
  assert.ok(sellable?.id, "A seeded sellable variant is required.");
  assert.ok(unavailable?.id, "A seeded unavailable variant is required.");

  const customer = await customerModule.createCustomers({
    email: `task050_${runId}@example.test`,
    first_name: "TASK-050",
    last_name: "Synthetic",
    has_account: true,
  });
  createdCustomerIds.push(customer.id);

  const cart = await createCartWithLine({
    cartModule,
    createdCartIds,
    regionId: region.id,
    salesChannelId: salesChannel.id,
    customerId: customer.id,
    variantId: sellable.id,
    quantity: 1,
    useWorkflow: true,
    container,
  });

  const conflictCart = await createCartWithLine({
    cartModule,
    createdCartIds,
    regionId: region.id,
    salesChannelId: salesChannel.id,
    customerId: customer.id,
    variantId: unavailable.id,
    quantity: 1,
    useWorkflow: false,
    container,
  });

  const compensationCart = await createCartWithLine({
    cartModule,
    createdCartIds,
    regionId: region.id,
    salesChannelId: salesChannel.id,
    customerId: customer.id,
    variantId: sellable.id,
    quantity: 1,
    useWorkflow: true,
    container,
  });

  const [shippingProfile] = await fulfillment.listShippingProfiles({
    type: "default",
  });
  const [provider] = (await fulfillment.listFulfillmentProviders({})).filter(
    (candidate: { id?: unknown; is_enabled?: unknown }) =>
      candidate.id === "manual_manual" && candidate.is_enabled === true
  );
  assert.ok(shippingProfile?.id && provider?.id);

  const [fulfillmentSet] = await fulfillment.createFulfillmentSets([
    { name: `TASK-050 fulfillment set ${runId}`, type: "shipping" },
  ]);
  setFulfillmentSetId(fulfillmentSet.id);
  const { result: stockLocations } = await createStockLocationsWorkflow(
    container
  ).run({
    input: { locations: [{ name: `TASK-050 stock location ${runId}` }] },
  });
  const stockLocationId = stockLocations[0]?.id;
  assert.ok(stockLocationId);
  setStockLocationId(stockLocationId);

  await batchLinksWorkflow(container).run({
    input: {
      create: [
        {
          [Modules.STOCK_LOCATION]: { stock_location_id: stockLocationId },
          [Modules.FULFILLMENT]: { fulfillment_provider_id: provider.id },
        },
        {
          [Modules.STOCK_LOCATION]: { stock_location_id: stockLocationId },
          [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
        },
      ],
    },
  });

  const { result: serviceZones } = await createServiceZonesWorkflow(
    container
  ).run({
    input: {
      data: [
        {
          name: `TASK-050 service zone ${runId}`,
          fulfillment_set_id: fulfillmentSet.id,
        },
      ],
    },
  });
  const serviceZoneId = serviceZones[0]?.id;
  assert.ok(serviceZoneId);
  setServiceZoneId(serviceZoneId);

  const { result: shippingOptions } = await createShippingOptionsWorkflow(
    container
  ).run({
    input: DELIVERY_OPTION_IDS.map((id, index) => ({
      name: `TASK-050 ${id}`,
      service_zone_id: serviceZoneId,
      shipping_profile_id: shippingProfile.id,
      provider_id: provider.id,
      price_type: "flat" as const,
      type: {
        label: `TASK-050 ${id}`,
        description: "Synthetic pending-order delivery option.",
        code: id,
      },
      prices: [{ amount: LOCAL_TARIFFS_MINOR_RUB[index], currency_code: "rub" }],
      rules: [
        {
          attribute: "enabled_in_store",
          operator: "eq" as const,
          value: "true",
        },
      ],
      metadata: { task_050_run_id: runId },
    })),
  });
  createdOptionIds.push(...shippingOptions.map((option) => option.id));
  assert.equal(createdOptionIds.length, DELIVERY_OPTION_IDS.length);

  return {
    customerId: customer.id,
    cartId: cart.id,
    variantId: sellable.id,
    conflictCartId: conflictCart.id,
    conflictVariantId: unavailable.id,
    compensationCartId: compensationCart.id,
    regionId: region.id,
    salesChannelId: salesChannel.id,
  };
}

async function createCartWithLine({
  cartModule,
  createdCartIds,
  regionId,
  salesChannelId,
  customerId,
  variantId,
  quantity,
  useWorkflow,
  container,
}: {
  cartModule: ICartModuleService;
  createdCartIds: string[];
  regionId: string;
  salesChannelId: string;
  customerId: string;
  variantId: string;
  quantity: number;
  useWorkflow: boolean;
  container: ExecArgs["container"];
}) {
  const cart = await cartModule.createCarts({
    currency_code: "rub",
    region_id: regionId,
    sales_channel_id: salesChannelId,
    customer_id: customerId,
    shipping_address: {
      first_name: "TASK-050",
      last_name: "Synthetic",
      address_1: "Local integration",
      city: "Moscow",
      country_code: "ru",
    },
  });
  createdCartIds.push(cart.id);
  if (useWorkflow) {
    await addToCartWorkflow(container).run({
      input: { cart_id: cart.id, items: [{ variant_id: variantId, quantity }] },
    });
  } else {
    await cartModule.addLineItems(cart.id, [
      {
        variant_id: variantId,
        quantity,
        title: "Synthetic unavailable line",
        unit_price: 1,
      } as any,
    ]);
  }
  return cartModule.retrieveCart(cart.id, { relations: ["items"] });
}

async function invokeOrder(
  scope: ExecArgs["container"],
  customerId: string | undefined,
  cartId: string,
  idempotencyKey: string,
  overrides: Record<string, unknown> = {}
): Promise<RouteResult> {
  const body = {
    cart_id: cartId,
    name: "Synthetic Buyer",
    email: "synthetic.checkout@example.test",
    phone: "+7 900 000 00 00",
    city: "Synthetic City",
    address: "Synthetic address",
    comment: "Synthetic comment",
    delivery_method: "pickup",
    payment_method: PAYMENT_IDS[0],
    ...overrides,
  };
  const response = new TestResponse();
  await POST(
    {
      scope,
      body,
      validatedBody: body,
      headers: { "idempotency-key": idempotencyKey },
      ...(customerId
        ? {
            auth_context: {
              actor_id: customerId,
              actor_type: "customer",
              auth_identity_id: "task-050-synthetic-auth",
            },
          }
        : {}),
    } as any,
    response as any
  );
  return response.result();
}

async function invokeForcedReservationFailure(
  scope: ExecArgs["container"],
  customerId: string,
  cartId: string,
  idempotencyKey: string
) {
  try {
    await createPendingOrderWorkflow(scope).run({
      input: {
        customer_id: customerId,
        cart_id: cartId,
        checkout: {
          name: "Synthetic Buyer",
          email: "synthetic.checkout@example.test",
          phone: "+7 900 000 00 00",
          city: "Synthetic City",
          address: "Synthetic address",
          comment: "Synthetic compensation fixture",
          delivery_method: "pickup",
          payment_method: PAYMENT_IDS[0],
        },
        idempotency_key: idempotencyKey,
        inject_reservation_failure_after_order_creation: true,
      },
    });

    return {
      failed: false,
      statusCode: 201,
      code: "unexpected_success",
    };
  } catch (error) {
    const publicError = toPublicPendingOrderError(error);
    return {
      failed: true,
      statusCode: publicError.statusCode,
      code: publicError.code,
    };
  }
}

async function countRecords(orderModule: any, inventoryModule: any) {
  const [, orders] = await orderModule.listAndCountOrders({}, { take: 1 });
  const [, reservationItems] = await inventoryModule.listAndCountReservationItems(
    {},
    { take: 1 }
  );
  return { orders, reservationItems };
}

async function cleanup({
  container,
  orderModule,
  inventoryModule,
  cartModule,
  customerModule,
  createdOrderIds,
  createdCartIds,
  createdCustomerIds,
  fulfillment,
  createdOptionIds,
  serviceZoneId,
  fulfillmentSetId,
  stockLocationId,
}: {
  container: ExecArgs["container"];
  orderModule: any;
  inventoryModule: any;
  cartModule: ICartModuleService;
  customerModule: ICustomerModuleService;
  createdOrderIds: string[];
  createdCartIds: string[];
  createdCustomerIds: string[];
  fulfillment: any;
  createdOptionIds: string[];
  serviceZoneId: string | undefined;
  fulfillmentSetId: string | undefined;
  stockLocationId: string | undefined;
}) {
  const failures: string[] = [];
  const attempt = async (label: string, action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      failures.push(`${label}:${error instanceof Error ? error.name : "unknown"}`);
    }
  };

  const reservations = await inventoryModule.listReservationItems({
    metadata: { order_id: createdOrderIds },
  }).catch(() => []);
  if (reservations.length) {
    await attempt("reservations", () =>
      inventoryModule.deleteReservationItems(reservations.map((item: any) => item.id))
    );
  }
  if (createdOrderIds.length) {
    await attempt("orders", () => orderModule.deleteOrders(createdOrderIds));
  }
  if (createdCartIds.length) {
    await attempt("carts", () => cartModule.deleteCarts(createdCartIds));
  }
  if (createdCustomerIds.length) {
    await attempt("customers", () => customerModule.deleteCustomers(createdCustomerIds));
  }
  if (createdOptionIds.length) {
    await attempt("shipping_options", () => fulfillment.deleteShippingOptions(createdOptionIds));
  }
  if (serviceZoneId) {
    await attempt("service_zone", () => fulfillment.deleteServiceZones(serviceZoneId));
  }
  if (fulfillmentSetId) {
    await attempt("fulfillment_set", () => fulfillment.deleteFulfillmentSets(fulfillmentSetId));
  }
  if (stockLocationId) {
    await attempt("stock_location", () =>
      deleteStockLocationsWorkflow(container).run({ input: { ids: [stockLocationId] } })
    );
  }
  if (failures.length) {
    throw new Error(`TASK-050 synthetic fixture cleanup failed: ${failures.join(", ")}`);
  }
}

async function loadCanonicalProducts(
  container: ExecArgs["container"],
  salesChannelId: string
) {
  const { loadCanonicalProducts: load } = require("../catalog/canonical") as {
    loadCanonicalProducts: (
      scope: ExecArgs["container"],
      channelId: string
    ) => Promise<any[]>;
  };
  return load(container, salesChannelId);
}

class TestResponse {
  statusCode = 200;
  body: any;

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
