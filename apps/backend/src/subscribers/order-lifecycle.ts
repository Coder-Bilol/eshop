import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import type { SubscriberArgs } from "@medusajs/framework/subscribers";

import { runApplyOrderLifecycleTransition } from "../workflows/order-lifecycle/apply-order-lifecycle-transition";

const EVENT_TO_LIFECYCLE = {
  "payment.captured": "payment_marked_paid",
  "order.fulfillment_created": "fulfillment_started",
  "order.completed": "order_completed",
  "order.canceled": "order_canceled",
  "payment.refunded": "payment_refunded",
} as const;

export const config = {
  event: Object.keys(EVENT_TO_LIFECYCLE),
};

export default async function orderLifecycleSubscriber({
  event,
  container,
}: SubscriberArgs<Record<string, unknown>>) {
  const eventName = event.name;
  if (!eventName || !(eventName in EVENT_TO_LIFECYCLE)) return;

  const data = event.data ?? {};
  let orderId = typeof data.id === "string" ? data.id : undefined;
  let paymentCollectionId: string | undefined;

  if (eventName === "order.fulfillment_created") {
    orderId = typeof data.order_id === "string" ? data.order_id : undefined;
  }

  if (eventName === "payment.captured" || eventName === "payment.refunded") {
    const paymentId = typeof data.id === "string" ? data.id : undefined;
    if (!paymentId) return;
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as any;
    const result = await query.graph({
      entity: "order",
      fields: ["id", "payment_collections.id", "payment_collections.payments.id"],
      filters: { "payment_collections.payments.id": paymentId },
      options: { limit: 1 },
    });
    const order = result?.data?.[0];
    orderId = typeof order?.id === "string" ? order.id : undefined;
    const collection = order?.payment_collections?.find((candidate: any) =>
      candidate.payments?.some((payment: any) => payment.id === paymentId)
    );
    paymentCollectionId = typeof collection?.id === "string" ? collection.id : undefined;
    if (!paymentCollectionId) return;
  }

  if (!orderId) return;
  const transition = {
    order_id: orderId,
    event: EVENT_TO_LIFECYCLE[eventName as keyof typeof EVENT_TO_LIFECYCLE],
    ...(paymentCollectionId ? { payment_collection_id: paymentCollectionId } : {}),
  };
  // Installed local event-bus dispatch does not await listeners in the native
  // mutation. Await projection here so failures reach the subscriber boundary.
  await runApplyOrderLifecycleTransition(container, { event: transition });
}
