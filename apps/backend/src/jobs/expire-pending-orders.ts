import type {
  IOrderModuleService,
  MedusaContainer,
  OrderDTO,
} from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

import {
  isExpiredPendingOrder,
  isPendingOrderExpiryCleanupDue,
} from "../checkout/pending-order";
import { expirePendingOrderWorkflow } from "../workflows/checkout/expire-pending-order";

export const config = {
  name: "ft-007-expire-pending-orders",
  schedule: "0 * * * *",
};

export function findExpiredPendingOrders(
  orders: OrderDTO[],
  now: Date = new Date()
): OrderDTO[] {
  return orders.filter(
    (order) =>
      isExpiredPendingOrder(order, now) ||
      isPendingOrderExpiryCleanupDue(order, now)
  );
}

export async function runExpirePendingOrdersJob(
  container: MedusaContainer,
  now: Date = new Date()
) {
  const orderModule = container.resolve<IOrderModuleService>(Modules.ORDER);
  const [pendingOrders, canceledOrders] = await Promise.all([
    orderModule.listOrders(
      { status: "pending" } as any,
      { relations: ["items"], take: null } as any
    ),
    orderModule.listOrders(
      { status: "canceled" } as any,
      { relations: ["items"], take: null } as any
    ),
  ]);
  const orders = [
    ...pendingOrders,
    ...canceledOrders.filter(
      (canceledOrder) =>
        !pendingOrders.some((pendingOrder) => pendingOrder.id === canceledOrder.id)
    ),
  ];
  const candidates = findExpiredPendingOrders(orders, now);
  let completed = 0;

  for (const order of candidates) {
    try {
      await expirePendingOrderWorkflow(container).run({
        input: { order_id: order.id, now: now.toISOString() },
      });
      completed += 1;
    } catch {
      // Keep the job retryable and avoid exposing order/customer data in logs.
    }
  }

  if (completed !== candidates.length) {
    throw new Error("FT-007 pending-order expiry has recoverable cleanup failures.");
  }

  return {
    selected: candidates.length,
    completed,
    failed: candidates.length - completed,
  };
}

export default async function expirePendingOrdersJob(
  container: MedusaContainer
) {
  return runExpirePendingOrdersJob(container);
}
