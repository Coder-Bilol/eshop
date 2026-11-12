import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";

import { hasCapturedPayment, isCumulativeFullRefund } from "./projection";
import type { LifecycleMetadata, NativeLifecycleSnapshot, NativePaymentEvidence } from "./types";

export type LifecycleOperation = "payment" | "cancel" | "fulfillment" | "complete" | "refund" | "metadata";

type NativePayment = NativePaymentEvidence & { payment_collection_id?: string };
export type NativeLifecycleOrder = {
  id: string;
  status: string;
  currency_code: string;
  metadata?: LifecycleMetadata | null;
  items?: { id: string }[];
  payment_collections?: (NativePaymentEvidence & { payments?: NativePayment[] })[];
  fulfillments?: { id: string; canceled_at?: string | Date | null }[];
};

/** Cross-module relations must be read through Query, not Order Module ORM relations. */
export async function loadNativeLifecycleOrder(
  container: MedusaContainer,
  orderId: string
): Promise<NativeLifecycleOrder> {
  const query = container.resolve<any>(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "order",
    filters: { id: orderId },
    fields: [
      "id", "status", "currency_code", "metadata", "items.id",
      "payment_collections.id", "payment_collections.status",
      "payment_collections.captured_amount", "payment_collections.refunded_amount",
      "payment_collections.payments.id", "payment_collections.payments.currency_code",
      "payment_collections.payments.payment_collection_id",
      "payment_collections.payments.captured_at",
      "payment_collections.payments.captured_amount", "payment_collections.payments.raw_captured_amount",
      "payment_collections.payments.refunded_amount", "payment_collections.payments.raw_refunded_amount",
      "payment_collections.payments.captures.*", "payment_collections.payments.refunds.*",
      "fulfillments.id", "fulfillments.canceled_at",
    ],
  });
  const order = data?.[0];
  if (!order || order.id !== orderId) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "The authoritative lifecycle order was not found.");
  }
  return order;
}

export function nativeLifecycleSnapshot(order: NativeLifecycleOrder): NativeLifecycleSnapshot {
  const paymentCollections = (order.payment_collections ?? []).flatMap<NativePaymentEvidence>((collection) => {
    const payments = collection.payments ?? [];
    if (payments.length === 0) {
      return [{ ...collection, order_id: order.id, currency_code: order.currency_code }];
    }
    return payments.map((payment) => {
      if (payment.payment_collection_id && payment.payment_collection_id !== collection.id) {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "The native payment collection binding is invalid.");
      }
      return {
        ...payment,
        id: collection.id,
        order_id: order.id,
        currency_code: payment.currency_code ?? order.currency_code,
        // PaymentDTO has no status; the collection owns the native payment status.
        status: collection.status,
      };
    });
  });
  const fulfillment = order.fulfillments?.find((candidate) => !candidate.canceled_at);
  return {
    order_id: order.id,
    status: order.status,
    metadata: order.metadata,
    payment_collections: paymentCollections,
    fulfillment_id: fulfillment?.id,
    fulfillment: fulfillment ? { id: fulfillment.id, started: true } : null,
  };
}

/** Only committed native evidence can authorize a mutation when projection is delayed. */
export function assertNativeLifecyclePrecondition(
  order: NativeLifecycleOrder,
  operation: LifecycleOperation,
  now = new Date()
): void {
  if (operation === "metadata") return;
  const snapshot = nativeLifecycleSnapshot(order);
  const metadata = order.metadata ?? {};
  const payments = snapshot.payment_collections ?? [];
  const captured = payments.some(hasCapturedPayment);
  const activeFulfillment = Boolean(snapshot.fulfillment_id);
  const fullRefund = isCumulativeFullRefund(payments);
  const expired = metadata.checkout_state === "expired" || metadata.checkout_expiry_origin === "ft-007";
  // Native terminal states and persisted captures outrank a stale logical projection.
  const state = order.status === "canceled" || expired || metadata.checkout_state === "canceled"
    ? "canceled"
    : fullRefund || metadata.checkout_state === "refunded"
      ? "refunded"
      : order.status === "completed"
        ? "completed"
        : captured && activeFulfillment
          ? "processing"
          : captured
            ? "paid"
            : "pending_payment";
  const deadline = metadata.pending_payment_expires_at;
  const pastDeadline = typeof deadline === "string" &&
    (!Number.isFinite(Date.parse(deadline)) || Date.parse(deadline) <= now.getTime());
  const allowed = order.status === "pending" || order.status === "completed";
  if (!allowed ||
      (operation === "payment" && (state !== "pending_payment" || pastDeadline || activeFulfillment)) ||
      (operation === "fulfillment" && !["paid", "processing"].includes(state)) ||
      (operation === "complete" && state !== "processing") ||
      (operation === "cancel" && (["completed", "canceled", "refunded"].includes(state) || activeFulfillment)) ||
      (operation === "refund" && !["paid", "processing", "completed"].includes(state))) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "The native order cannot perform this lifecycle operation from its current state.");
  }
}
