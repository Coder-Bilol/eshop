import type { IOrderModuleService, MedusaContainer, OrderDTO } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
  type WorkflowData,
} from "@medusajs/framework/workflows-sdk";
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows";

import { orderLifecycleLockKey } from "../../order-lifecycle/lock";
import { projectOrderLifecycle } from "../../order-lifecycle/projection";
import type {
  LifecycleProjectionResult,
  NativeLifecycleSnapshot,
  NativePaymentEvidence,
} from "../../order-lifecycle/types";

export type ApplyOrderLifecycleTransitionInput = {
  event: unknown;
};

type NativeOrderWithLifecycle = OrderDTO & {
  payment_collections?: any[];
  fulfillments?: any[];
};

const loadAndProjectStep = createStep(
  "ft-008-load-authoritative-order-and-project",
  async (
    input: ApplyOrderLifecycleTransitionInput,
    { container }
  ): Promise<StepResponse<LifecycleProjectionResult>> => {
    const event = input.event as { order_id?: unknown };
    if (typeof event?.order_id !== "string" || event.order_id.trim() === "") {
      throw new Error("A server-owned lifecycle event must identify an order.");
    }

    const orderModule = container.resolve<IOrderModuleService>(Modules.ORDER);
    let order: NativeOrderWithLifecycle;
    try {
      order = (await orderModule.retrieveOrder(event.order_id, {
        relations: [
          "payment_collections",
          "payment_collections.payments",
          "payment_collections.payments.captures",
          "payment_collections.payments.refunds",
          "fulfillments",
        ],
      } as any)) as NativeOrderWithLifecycle;
    } catch {
      throw new Error("The authoritative lifecycle order was not found.");
    }

    if (!order.id || order.id !== event.order_id) {
      throw new Error("The authoritative order binding is invalid.");
    }

    const paymentCollections = (order.payment_collections ?? []).flatMap(
      (collection: any): NativePaymentEvidence[] => {
        const payments = Array.isArray(collection?.payments)
          ? collection.payments
          : [];
        if (payments.length === 0) {
          return [
            {
              id: collection?.id,
              order_id: order.id,
              currency_code: order.currency_code,
              status: collection?.status,
              captured_amount: collection?.captured_amount,
              refunded_amount: collection?.refunded_amount,
            },
          ];
        }

        return payments.map((payment: any) => ({
          id: collection?.id,
          order_id: order.id,
          currency_code: order.currency_code,
          status: payment?.status,
          captured_amount: payment?.captured_amount,
          refunded_amount: payment?.refunded_amount,
          raw_captured_amount: payment?.raw_captured_amount,
          raw_refunded_amount: payment?.raw_refunded_amount,
          captures: payment?.captures,
          refunds: payment?.refunds,
        }));
      }
    );
    const fulfillment = Array.isArray(order.fulfillments)
      ? order.fulfillments.find((candidate: any) => !candidate?.canceled_at) ??
        order.fulfillments[0]
      : undefined;
    const snapshot: NativeLifecycleSnapshot = {
      order_id: order.id,
      status: order.status,
      metadata: (order.metadata ?? {}) as Record<string, unknown>,
      payment_collections: paymentCollections,
      fulfillment_id: fulfillment?.id,
      fulfillment: fulfillment
        ? {
            id: fulfillment.id,
            status: fulfillment.status,
            started: true,
          }
        : null,
    };

    const projected = projectOrderLifecycle({ snapshot, event: input.event });
    if (projected.changed) {
      await orderModule.updateOrders(order.id, {
        metadata: projected.metadata,
      });
    }

    return new StepResponse(projected);
  }
);

export const applyOrderLifecycleTransition = createWorkflow(
  "ft-008-apply-order-lifecycle-transition",
  (input: WorkflowData<ApplyOrderLifecycleTransitionInput>) => {
    const orderId = transform(input, ({ event }) => {
      const value = event as { order_id?: unknown };
      if (typeof value?.order_id !== "string") {
        throw new Error("A lifecycle event order_id is required.");
      }
      return value.order_id;
    });
    const lockKey = transform(orderId, orderLifecycleLockKey);
    acquireLockStep({ key: lockKey, timeout: 5, retryInterval: 0.1, ttl: 120 });
    const projected = loadAndProjectStep(input);
    releaseLockStep({ key: lockKey });
    return new WorkflowResponse(projected);
  }
);

export async function runApplyOrderLifecycleTransition(
  container: MedusaContainer,
  input: ApplyOrderLifecycleTransitionInput
) {
  return applyOrderLifecycleTransition(container).run({ input });
}
