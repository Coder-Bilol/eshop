import type { MedusaContainer } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

export const ORDER_LIFECYCLE_LOCK_PREFIX = "order-lifecycle:";

export function orderLifecycleLockKey(orderId: string): string {
  if (typeof orderId !== "string" || orderId.trim() === "") {
    throw new Error("An order id is required for the lifecycle lock.");
  }

  return `${ORDER_LIFECYCLE_LOCK_PREFIX}${orderId}`;
}

export async function withOrderLifecycleLock<T>(
  container: MedusaContainer,
  orderId: string,
  work: () => Promise<T>
): Promise<T> {
  const locking = container.resolve<any>(Modules.LOCKING);
  return locking.execute(orderLifecycleLockKey(orderId), work, {
    timeout: 5,
  });
}
