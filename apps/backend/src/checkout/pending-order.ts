import { createHash } from "node:crypto";

import type {
  CartDTO,
  CartLineItemDTO,
  OrderDTO,
  OrderLineItemDTO,
} from "@medusajs/framework/types";

import type { StoreCheckoutInput } from "./validation";

export const PENDING_ORDER_TTL_HOURS = 72;
export const PENDING_ORDER_CREATED_BY = "ft-007:create-pending-order";
const MAX_OPAQUE_REFERENCE_LENGTH = 128;
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

export type PendingOrderErrorCode =
  | "checkout_auth_required"
  | "checkout_invalid_request"
  | "checkout_validation_failed"
  | "delivery_method_unavailable"
  | "checkout_cart_forbidden"
  | "checkout_cart_not_found"
  | "checkout_idempotency_conflict"
  | "checkout_stock_conflict"
  | "checkout_order_failed";

export class PendingOrderRequestError extends Error {
  readonly statusCode = 400;
  readonly code = "checkout_invalid_request" as const;

  constructor(message = "Pending-order request is invalid.") {
    super(message);
    this.name = "PendingOrderRequestError";
  }
}

export class PendingOrderError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: PendingOrderErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "PendingOrderError";
  }
}

export type PendingOrderInput = {
  customer_id: string;
  cart_id: string;
  checkout: StoreCheckoutInput;
  idempotency_key: string;
};

export type PendingOrderResult = {
  order_id: string;
  status: "pending_payment";
  expires_at: string;
  payment_id: StoreCheckoutInput["payment_method"];
  replayed: boolean;
};

export type PendingOrderCartLine = {
  source_cart_line_id: string;
  variant_id: string;
  quantity: number;
};

export type PendingOrderReservationBlueprint = {
  line_index: number;
  inventory_item_id: string;
  required_quantity: number;
  allow_backorder: boolean;
  location_ids: [string];
};

export type PendingOrderPreparation = {
  cart: CartDTO;
  lines: PendingOrderCartLine[];
  variants: any[];
  reservation_blueprints: PendingOrderReservationBlueprint[];
  managed_line_indexes: number[];
  existing_order: OrderDTO | null;
  request_fingerprint: string;
};

export function normalizeCartReference(value: unknown): string {
  if (typeof value !== "string") {
    throw new PendingOrderRequestError("Cart reference is required.");
  }

  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > MAX_OPAQUE_REFERENCE_LENGTH ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new PendingOrderRequestError("Cart reference is invalid.");
  }

  return normalized;
}

export function normalizeIdempotencyKey(value: unknown): string {
  if (typeof value !== "string") {
    throw new PendingOrderRequestError("A valid Idempotency-Key header is required.");
  }

  const normalized = value.trim();
  if (
    !normalized ||
    normalized.length > MAX_IDEMPOTENCY_KEY_LENGTH ||
    /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    throw new PendingOrderRequestError("A valid Idempotency-Key header is required.");
  }

  return normalized;
}

export function pendingOrderExpiresAt(now: Date = new Date()): string {
  const timestamp = now.getTime();
  if (!Number.isFinite(timestamp)) {
    throw new PendingOrderRequestError("Server time is invalid.");
  }

  return new Date(
    timestamp + PENDING_ORDER_TTL_HOURS * 60 * 60 * 1000
  ).toISOString();
}

export function pendingOrderFingerprint(input: {
  cart_id: string;
  checkout: StoreCheckoutInput;
}): string {
  const canonical = JSON.stringify({
    cart_id: input.cart_id,
    checkout: {
      address: input.checkout.address ?? null,
      city: input.checkout.city,
      comment: input.checkout.comment ?? null,
      delivery_method: input.checkout.delivery_method,
      email: input.checkout.email,
      name: input.checkout.name,
      payment_method: input.checkout.payment_method,
      phone: input.checkout.phone,
    },
  });

  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function pendingOrderLockKey(input: PendingOrderInput): string {
  return `ft-007:pending-order:${input.customer_id}:${input.cart_id}`;
}

export function pendingOrderExpiryLockKey(orderId: string): string {
  return `ft-007:pending-order-expiry:${orderId}`;
}

export function numericQuantity(value: unknown): number {
  const primitive =
    typeof value === "object" && value !== null && "value" in value
      ? (value as { value: unknown }).value
      : value;
  const quantity = Number(primitive);
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new PendingOrderError(
      409,
      "checkout_stock_conflict",
      "Cart lines cannot be reserved."
    );
  }
  return quantity;
}

export function buildPendingOrderLines(cart: CartDTO): PendingOrderCartLine[] {
  const items = cart.items ?? [];
  if (items.length === 0) {
    throw new PendingOrderError(
      409,
      "checkout_cart_not_found",
      "Cart is empty or no longer active."
    );
  }

  return items.map((item: CartLineItemDTO) => {
    const variantId = typeof item.variant_id === "string" ? item.variant_id : "";
    if (!item.id || !variantId) {
      throw new PendingOrderError(
        409,
        "checkout_stock_conflict",
        "Cart lines cannot be reserved."
      );
    }

    return {
      source_cart_line_id: item.id,
      variant_id: variantId,
      quantity: numericQuantity(item.quantity),
    };
  });
}

export function buildReservationBlueprints(
  lines: PendingOrderCartLine[],
  variants: any[],
  salesChannelId: string
): {
  reservation_blueprints: PendingOrderReservationBlueprint[];
  managed_line_indexes: number[];
} {
  const variantById = new Map<string, any>(
    variants
      .filter((variant) => typeof variant?.id === "string")
      .map((variant) => [variant.id, variant])
  );
  const reservationBlueprints: PendingOrderReservationBlueprint[] = [];
  const managedLineIndexes: number[] = [];

  lines.forEach((line, lineIndex) => {
    const variant = variantById.get(line.variant_id);
    if (!variant) {
      throw new PendingOrderError(
        409,
        "checkout_stock_conflict",
        "Cart lines cannot be reserved."
      );
    }

    if (!variant.manage_inventory) return;
    managedLineIndexes.push(lineIndex);

    const inventoryItems = Array.isArray(variant.inventory_items)
      ? variant.inventory_items
      : [];
    if (inventoryItems.length === 0) {
      throw new PendingOrderError(
        409,
        "checkout_stock_conflict",
        "Selected inventory is unavailable."
      );
    }

    for (const inventoryItem of inventoryItems) {
      const inventoryItemId = inventoryItem?.inventory_item_id;
      const requiredQuantity = Number(inventoryItem?.required_quantity ?? 1);
      const locationIds = locationIdsForSalesChannel(
        inventoryItem?.inventory?.location_levels,
        salesChannelId
      );

      if (
        typeof inventoryItemId !== "string" ||
        !Number.isSafeInteger(requiredQuantity) ||
        requiredQuantity <= 0 ||
        locationIds.length !== 1
      ) {
        throw new PendingOrderError(
          409,
          "checkout_stock_conflict",
          "Selected inventory allocation is unavailable."
        );
      }

      reservationBlueprints.push({
        line_index: lineIndex,
        inventory_item_id: inventoryItemId,
        required_quantity: requiredQuantity,
        allow_backorder: inventoryItem?.allow_backorder === true || variant.allow_backorder === true,
        location_ids: [locationIds[0]],
      });
    }
  });

  return {
    reservation_blueprints: reservationBlueprints,
    managed_line_indexes: managedLineIndexes,
  };
}

function locationIdsForSalesChannel(
  levels: unknown,
  salesChannelId: string
): string[] {
  if (!Array.isArray(levels)) return [];

  return [
    ...new Set(
      levels.flatMap((level) => {
        const locationId = level?.location_id;
        const stockLocations = Array.isArray(level?.stock_locations)
          ? level.stock_locations
          : level?.stock_locations
            ? [level.stock_locations]
            : [];
        const servesChannel = stockLocations.some((stockLocation: any) =>
          Array.isArray(stockLocation?.sales_channels)
            ? stockLocation.sales_channels.some(
                (channel: any) => channel?.id === salesChannelId
              )
            : false
        );
        return servesChannel && typeof locationId === "string"
          ? [locationId]
          : [];
      })
    ),
  ];
}

export function orderMetadata(input: {
  cart_id: string;
  checkout: StoreCheckoutInput;
  idempotency_key: string;
  fingerprint: string;
  expires_at: string;
  managed_line_count: number;
}) {
  return {
    checkout_state: "pending_payment",
    pending_payment_expires_at: input.expires_at,
    checkout_cart_id: input.cart_id,
    checkout_idempotency_key: input.idempotency_key,
    checkout_request_fingerprint: input.fingerprint,
    checkout_delivery_method: input.checkout.delivery_method,
    checkout_payment_method: input.checkout.payment_method,
    checkout_customer_comment: input.checkout.comment ?? null,
    checkout_managed_line_count: input.managed_line_count,
  } satisfies Record<string, unknown>;
}

export function toPendingOrderResult(
  order: OrderDTO,
  paymentId: StoreCheckoutInput["payment_method"],
  replayed: boolean
): PendingOrderResult {
  const metadata = isRecord(order.metadata) ? order.metadata : {};
  const expiresAt = metadata.pending_payment_expires_at;
  if (typeof expiresAt !== "string" || !order.id) {
    throw new PendingOrderError(
      500,
      "checkout_order_failed",
      "Pending order state is incomplete."
    );
  }

  return {
    order_id: order.id,
    status: "pending_payment",
    expires_at: expiresAt,
    payment_id: paymentId,
    replayed,
  };
}

export function mapReservationInputs(
  orderItems: OrderLineItemDTO[] | undefined,
  preparation: PendingOrderPreparation
) {
  if (!orderItems || orderItems.length !== preparation.lines.length) {
    throw new PendingOrderError(
      500,
      "checkout_order_failed",
      "Pending order lines could not be reconciled."
    );
  }

  const orderItemBySourceLine = new Map<string, OrderLineItemDTO>();
  for (const item of orderItems) {
    const sourceLineId = isRecord(item.metadata)
      ? item.metadata.checkout_cart_line_id
      : undefined;
    if (typeof sourceLineId === "string") {
      orderItemBySourceLine.set(sourceLineId, item);
    }
  }

  return preparation.reservation_blueprints.map((blueprint) => {
    const sourceLine = preparation.lines[blueprint.line_index];
    const orderItem = orderItemBySourceLine.get(sourceLine.source_cart_line_id) ??
      orderItems[blueprint.line_index];
    if (
      !orderItem?.id ||
      orderItem.variant_id !== sourceLine.variant_id ||
      numericQuantity(orderItem.quantity) !== sourceLine.quantity
    ) {
      throw new PendingOrderError(
        500,
        "checkout_order_failed",
        "Pending order lines could not be reconciled."
      );
    }

    return {
      id: orderItem.id,
      inventory_item_id: blueprint.inventory_item_id,
      required_quantity: blueprint.required_quantity,
      allow_backorder: blueprint.allow_backorder,
      quantity: sourceLine.quantity,
      location_ids: blueprint.location_ids,
    };
  });
}

export function isPendingOrderMetadata(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    value.checkout_state === "pending_payment" &&
    typeof value.pending_payment_expires_at === "string"
  );
}

export function isExpiredPendingOrder(
  order: Pick<OrderDTO, "status" | "metadata">,
  now: Date = new Date()
): boolean {
  if (order.status !== "pending" || !isPendingOrderMetadata(order.metadata)) {
    return false;
  }

  const nowTimestamp = now.getTime();
  const expiresAt = Date.parse(String(order.metadata.pending_payment_expires_at));
  return Number.isFinite(nowTimestamp) && Number.isFinite(expiresAt) && expiresAt <= nowTimestamp;
}

export function isPendingOrderExpiryCleanup(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    value.checkout_state === "expired" &&
    value.checkout_expiry_cleanup === "pending" &&
    typeof value.pending_payment_expires_at === "string"
  );
}

export function isPendingOrderExpiryCleanupDue(
  order: Pick<OrderDTO, "status" | "metadata">,
  now: Date = new Date()
): boolean {
  if (order.status !== "canceled" || !isPendingOrderExpiryCleanup(order.metadata)) {
    return false;
  }

  const nowTimestamp = now.getTime();
  const expiresAt = Date.parse(
    String(order.metadata.pending_payment_expires_at)
  );
  return (
    Number.isFinite(nowTimestamp) &&
    Number.isFinite(expiresAt) &&
    expiresAt <= nowTimestamp
  );
}

export function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
