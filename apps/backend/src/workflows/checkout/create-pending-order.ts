import type {
  ICartModuleService,
  IInventoryService,
  IOrderModuleService,
  MedusaContainer,
  OrderDTO,
} from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
  when,
  type WorkflowData,
} from "@medusajs/framework/workflows-sdk";
import {
  acquireLockStep,
  createOrderWorkflow,
  releaseLockStep,
  reserveInventoryStep,
} from "@medusajs/medusa/core-flows";

import {
  buildPendingOrderLines,
  buildReservationBlueprints,
  isPendingOrderMetadata,
  mapReservationInputs,
  orderMetadata,
  pendingOrderExpiresAt,
  pendingOrderFingerprint,
  pendingOrderLockKey,
  PendingOrderError,
  type PendingOrderInput,
  type PendingOrderPreparation,
  toPendingOrderResult,
} from "../../checkout/pending-order";
import { validateCheckoutWorkflow } from "./validate-checkout";

type GraphQuery = {
  graph: (input: Record<string, unknown>) => Promise<{ data: any[] }>;
};

const INVENTORY_VARIANT_FIELDS = [
  "id",
  "manage_inventory",
  "allow_backorder",
  "inventory_items.inventory_item_id",
  "inventory_items.required_quantity",
  "inventory_items.inventory.location_levels.location_id",
  "inventory_items.inventory.location_levels.stock_locations.id",
  "inventory_items.inventory.location_levels.stock_locations.sales_channels.id",
];

export type CreatePendingOrderWorkflowInput = PendingOrderInput & {
  /** Local integration harness only; never set by the Store API route. */
  inject_reservation_failure_after_order_creation?: boolean;
};

type NativeReservationInput = {
  id?: string;
  inventory_item_id: string;
  required_quantity: number;
  allow_backorder: boolean;
  quantity: number;
  location_ids: string[];
};

type ReservationFailureHarnessInput = {
  order_id?: string;
  reservation_inputs: NativeReservationInput[];
  inject: boolean;
};

const forceNativeReservationFailureStep = createStep(
  "ft-007-test-native-reservation-failure",
  async (input: ReservationFailureHarnessInput) => {
    if (!input.inject) {
      return new StepResponse(input.reservation_inputs);
    }

    if (!input.order_id || input.reservation_inputs.length === 0) {
      throw new Error(
        "TASK-050 reservation-failure harness requires a created order and a managed line."
      );
    }

    const [first, ...rest] = input.reservation_inputs;
    return new StepResponse([
      {
        ...first,
        inventory_item_id: "iitem_task050_forced_reservation_failure",
      },
      ...rest,
    ]);
  }
);

const loadPendingOrderPreparationStep = createStep(
  "ft-007-load-pending-order-preparation",
  async (
    input: PendingOrderInput,
    { container }
  ): Promise<StepResponse<PendingOrderPreparation>> => {
    const fingerprint = pendingOrderFingerprint(input);
    const orderModule = container.resolve<IOrderModuleService>(Modules.ORDER);
    const existingOrders = await orderModule.listOrders(
      {},
      { relations: ["items"], take: null } as any
    );
    const matchingOrder = findMatchingIdempotencyOrder(
      existingOrders,
      input.idempotency_key
    );
    const existingCartOrder = matchingOrder ?? findMatchingPendingCartOrder(
      existingOrders,
      input
    );

    if (existingCartOrder) {
      assertExistingOrderMatches(existingCartOrder, input, fingerprint);
      await assertExistingReservationSet(
        container,
        existingCartOrder,
        Number(existingCartOrder.metadata?.checkout_managed_line_count ?? 0)
      );
      return new StepResponse({
        cart: {} as any,
        lines: [],
        variants: [],
        reservation_blueprints: [],
        managed_line_indexes: [],
        existing_order: existingCartOrder,
        request_fingerprint: fingerprint,
      });
    }

    const cartModule = container.resolve<ICartModuleService>(Modules.CART);
    let cart;
    try {
      cart = await cartModule.retrieveCart(input.cart_id, {
        relations: ["items"],
      });
    } catch {
      throw new PendingOrderError(
        404,
        "checkout_cart_not_found",
        "Cart was not found."
      );
    }

    if (cart.customer_id && cart.customer_id !== input.customer_id) {
      throw new PendingOrderError(
        403,
        "checkout_cart_forbidden",
        "Cart is not owned by the authenticated customer."
      );
    }
    if (cart.completed_at || cart.customer_id !== input.customer_id) {
      throw new PendingOrderError(
        cart.customer_id ? 404 : 403,
        cart.customer_id ? "checkout_cart_not_found" : "checkout_cart_forbidden",
        "Cart is not available for this customer."
      );
    }
    if (!cart.region_id || !cart.sales_channel_id || !cart.currency_code) {
      throw new PendingOrderError(
        409,
        "checkout_cart_not_found",
        "Cart is not ready for checkout."
      );
    }

    const lines = buildPendingOrderLines(cart);
    const query = container.resolve(
      ContainerRegistrationKeys.QUERY
    ) as unknown as GraphQuery;
    const variantIds = [...new Set(lines.map((line) => line.variant_id))];
    const { data: variants } = await query.graph({
      entity: "variants",
      fields: INVENTORY_VARIANT_FIELDS,
      filters: { id: variantIds },
    });
    if (!Array.isArray(variants) || variants.length !== variantIds.length) {
      throw new PendingOrderError(
        409,
        "checkout_stock_conflict",
        "Cart lines are no longer available."
      );
    }

    const { reservation_blueprints, managed_line_indexes } =
      buildReservationBlueprints(lines, variants, cart.sales_channel_id);

    return new StepResponse({
      cart,
      lines,
      variants,
      reservation_blueprints,
      managed_line_indexes,
      existing_order: null,
      request_fingerprint: fingerprint,
    });
  }
);

const annotateReservationItemsStep = createStep(
  "ft-007-annotate-reservation-items",
  async (
    input: {
      order_id: string;
      expires_at: string;
      reservation_ids: string[];
    },
    { container }
  ) => {
    const inventory = container.resolve<IInventoryService>(Modules.INVENTORY);
    const updated = [];
    for (const reservationId of input.reservation_ids) {
      updated.push(
        await inventory.updateReservationItems({
          id: reservationId,
          description: "FT-007 pending-payment inventory hold",
          metadata: {
            order_id: input.order_id,
            expires_at: input.expires_at,
            state: "reserved",
          },
        })
      );
    }
    return new StepResponse(updated);
  }
);

const persistPendingOrderMetadataStep = createStep(
  "ft-007-persist-pending-order-metadata",
  async (
    input: {
      order: OrderDTO;
      initial_metadata: Record<string, unknown>;
      reservation_ids: string[];
      managed_line_ids: string[];
    },
    { container }
  ): Promise<StepResponse<OrderDTO>> => {
    const orderModule = container.resolve<IOrderModuleService>(Modules.ORDER);
    const order = await orderModule.updateOrders(input.order.id, {
      metadata: {
        ...input.initial_metadata,
        checkout_reservation_item_ids: input.reservation_ids,
        checkout_reservation_line_ids: input.managed_line_ids,
      },
    });
    return new StepResponse(order);
  }
);

export const createPendingOrderWorkflow = createWorkflow(
  {
    name: "ft-007-create-pending-order",
    idempotent: false,
  },
  (input: WorkflowData<CreatePendingOrderWorkflowInput>) => {
    const lockKey = transform(input, pendingOrderLockKey);
    acquireLockStep({ key: lockKey, timeout: 5, retryInterval: 0.1, ttl: 120 });

    const preparation = loadPendingOrderPreparationStep(input);
    const checkoutValidation = when(
      "ft-007-validate-checkout",
      { preparation },
      ({ preparation }) => !preparation.existing_order
    ).then(() =>
      validateCheckoutWorkflow.runAsStep({
        input: transform(input, (value) => ({
          customer_id: value.customer_id,
          checkout: value.checkout,
        })),
      })
    );

    const expiresAt = transform({}, () => pendingOrderExpiresAt());
    const createOrderInput = transform(
      { input, preparation, checkoutValidation, expiresAt },
      ({ input, preparation, checkoutValidation, expiresAt }) => {
        if (!preparation.cart.id || !checkoutValidation) return null;
        const metadata = orderMetadata({
          cart_id: input.cart_id,
          checkout: input.checkout,
          idempotency_key: input.idempotency_key,
          fingerprint: preparation.request_fingerprint,
          expires_at: expiresAt,
          managed_line_count: preparation.managed_line_indexes.length,
        });
        return {
          region_id: preparation.cart.region_id,
          sales_channel_id: preparation.cart.sales_channel_id,
          customer_id: input.customer_id,
          email: input.checkout.email,
          currency_code: preparation.cart.currency_code,
          status: "pending",
          no_notification: true,
          shipping_address: {
            first_name: input.checkout.name,
            address_1: input.checkout.address,
            city: input.checkout.city,
            phone: input.checkout.phone,
            country_code: "ru",
          },
          items: preparation.lines.map((line) => ({
            variant_id: line.variant_id,
            quantity: line.quantity,
            metadata: { checkout_cart_line_id: line.source_cart_line_id },
          })),
          shipping_methods: [
            {
              name: input.checkout.delivery_method,
              amount: checkoutValidation.snapshot.tariff.amount,
              data: { checkout_delivery_id: input.checkout.delivery_method },
            },
          ],
          metadata,
        };
      }
    );

    const createdOrder = when(
      "ft-007-create-native-order",
      { preparation, createOrderInput },
      ({ preparation }) => !preparation.existing_order
    ).then(() =>
      createOrderWorkflow.runAsStep({ input: createOrderInput as any })
    );

    const reservationInputs = transform(
      { preparation, createdOrder },
      ({ preparation, createdOrder }) =>
        createdOrder
          ? mapReservationInputs(createdOrder.items, preparation)
          : []
    );
    const nativeReservationInputs = forceNativeReservationFailureStep({
      order_id: transform(
        { createdOrder },
        ({ createdOrder }) => createdOrder?.id
      ),
      reservation_inputs: reservationInputs,
      inject: transform(
        input,
        (value) => value.inject_reservation_failure_after_order_creation === true
      ),
    });
    const reservations = when(
      "ft-007-reserve-native-inventory",
      { preparation, createdOrder, nativeReservationInputs },
      ({ preparation, createdOrder }) =>
        !preparation.existing_order && !!createdOrder
    ).then(() =>
      reserveInventoryStep({ items: nativeReservationInputs as any })
    );

    const reservationIds = transform(
      { reservations },
      ({ reservations }) =>
        Array.isArray(reservations)
          ? reservations.flatMap((reservation: any) =>
              typeof reservation?.id === "string" ? [reservation.id] : []
            )
          : []
    );
    const managedLineIds = transform(
      { createdOrder, preparation },
      ({ createdOrder, preparation }) =>
        preparation.managed_line_indexes.map(
          (lineIndex) => createdOrder?.items?.[lineIndex]?.id
        ).filter((id): id is string => typeof id === "string")
    );
    const annotated = when(
      "ft-007-annotate-native-reservations",
      { preparation, createdOrder, reservationIds },
      ({ preparation, createdOrder }) =>
        !preparation.existing_order && !!createdOrder
    ).then(() =>
      annotateReservationItemsStep({
        order_id: createdOrder!.id,
        expires_at: expiresAt,
        reservation_ids: reservationIds,
      })
    );

    const finalizedOrder = when(
      "ft-007-finalize-pending-order",
      { preparation, createdOrder, annotated, reservationIds, managedLineIds, createOrderInput },
      ({ preparation, createdOrder }) =>
        !preparation.existing_order && !!createdOrder
    ).then(() =>
      persistPendingOrderMetadataStep({
        order: createdOrder!,
        initial_metadata: (createOrderInput as any).metadata,
        reservation_ids: reservationIds,
        managed_line_ids: managedLineIds,
      })
    );

    releaseLockStep({ key: lockKey });

    return new WorkflowResponse(
      transform(
        { finalizedOrder, input, preparation },
        ({ finalizedOrder, input, preparation }) =>
          preparation.existing_order
            ? toPendingOrderResult(
                preparation.existing_order,
                input.checkout.payment_method,
                true
              )
            : toPendingOrderResult(
                finalizedOrder!,
                input.checkout.payment_method,
                false
              )
      )
    );
  }
);

function findMatchingIdempotencyOrder(
  orders: OrderDTO[],
  idempotencyKey: string
): OrderDTO | null {
  return (
    orders.find(
      (order) =>
        isPendingOrderMetadata(order.metadata) &&
        order.metadata.checkout_idempotency_key === idempotencyKey
    ) ?? null
  );
}

function findMatchingPendingCartOrder(
  orders: OrderDTO[],
  input: PendingOrderInput
): OrderDTO | null {
  return (
    orders.find(
      (order) =>
        isPendingOrderMetadata(order.metadata) &&
        order.customer_id === input.customer_id &&
        order.metadata.checkout_cart_id === input.cart_id
    ) ?? null
  );
}

function assertExistingOrderMatches(
  order: OrderDTO,
  input: PendingOrderInput,
  fingerprint: string
) {
  const metadata = order.metadata ?? {};
  if (
    metadata.checkout_cart_id !== input.cart_id ||
    metadata.checkout_request_fingerprint !== fingerprint ||
    order.customer_id !== input.customer_id
  ) {
    throw new PendingOrderError(
      409,
      "checkout_idempotency_conflict",
      "Idempotency key was already used for another checkout."
    );
  }

  const expiresAt = Date.parse(String(metadata.pending_payment_expires_at));
  if (
    order.status !== "pending" ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now()
  ) {
    throw new PendingOrderError(
      409,
      "checkout_idempotency_conflict",
      "Pending order is no longer retryable."
    );
  }
}

async function assertExistingReservationSet(
  container: MedusaContainer,
  order: OrderDTO,
  managedLineCount: number
) {
  if (!managedLineCount) return;
  const lineIds = (order.items ?? [])
    .map((item) => item.id)
    .filter((id): id is string => typeof id === "string");
  const inventory = container.resolve<IInventoryService>(Modules.INVENTORY);
  const reservations = await inventory.listReservationItems({
    line_item_id: lineIds,
  } as any);
  const linkedLineIds = new Set(
    reservations
      .filter((reservation: any) =>
        reservation.metadata &&
        typeof reservation.metadata === "object" &&
        reservation.metadata.order_id === order.id &&
        reservation.metadata.state === "reserved"
      )
      .map((reservation: any) => reservation.line_item_id)
  );
  if (linkedLineIds.size < managedLineCount) {
    throw new PendingOrderError(
      500,
      "checkout_order_failed",
      "Pending order reservation state is incomplete."
    );
  }
}
