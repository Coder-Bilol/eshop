import type {
  IOrderModuleService,
  MedusaContainer,
  OrderDTO,
} from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
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
  cancelOrderWorkflow,
  deleteReservationsByLineItemsStep,
  releaseLockStep,
} from "@medusajs/medusa/core-flows";

import {
  isExpiredPendingOrder,
  isPendingOrderExpiryCleanup,
  pendingOrderExpiryLockKey,
} from "../../checkout/pending-order";

export type ExpirePendingOrderWorkflowInput = {
  order_id: string;
  /** Optional deterministic clock used by local integration fixtures. */
  now?: string;
  /** Local integration harness only; never set by the cron job. */
  simulate_partial_cleanup_failure?: boolean;
};

type ExpiryAction = "cancel" | "cleanup" | "skip";

type ExpiryCandidate = {
  order: OrderDTO;
  action: ExpiryAction;
  line_item_ids: string[];
};

const loadExpiryCandidateStep = createStep(
  "ft-007-load-pending-order-expiry-candidate",
  async (
    input: ExpirePendingOrderWorkflowInput,
    { container }
  ): Promise<StepResponse<ExpiryCandidate>> => {
    const orderModule = container.resolve<IOrderModuleService>(Modules.ORDER);
    let order: OrderDTO;
    try {
      order = await orderModule.retrieveOrder(input.order_id, {
        relations: ["items"],
      });
    } catch {
      return new StepResponse({
        order: { id: input.order_id } as OrderDTO,
        action: "skip",
        line_item_ids: [],
      });
    }

    const now = input.now ? new Date(input.now) : new Date();
    const metadata = order.metadata;
    const action: ExpiryAction = isExpiredPendingOrder(order, now)
      ? "cancel"
      : order.status === "canceled" && isPendingOrderExpiryCleanup(metadata)
        ? "cleanup"
        : "skip";

    return new StepResponse({
      order,
      action,
      line_item_ids: (order.items ?? [])
        .map((item) => item.id)
        .filter((id): id is string => typeof id === "string"),
    });
  }
);

const markExpiryCleanupPendingStep = createStep(
  "ft-007-mark-pending-order-expiry-cleanup",
  async (
    input: { order_id: string; metadata: Record<string, unknown> },
    { container }
  ): Promise<StepResponse<OrderDTO>> => {
    const orderModule = container.resolve<IOrderModuleService>(Modules.ORDER);
    const order = await orderModule.updateOrders(input.order_id, {
      metadata: {
        ...input.metadata,
        checkout_state: "expired",
        checkout_expiry_reason: "payment_timeout",
        checkout_expiry_cleanup: "pending",
      },
    });
    return new StepResponse(order);
  }
);

const markExpiryCleanupCompleteStep = createStep(
  "ft-007-mark-pending-order-expiry-complete",
  async (
    input: { order_id: string; simulate_partial_cleanup_failure?: boolean },
    { container }
  ): Promise<StepResponse<OrderDTO>> => {
    if (input.simulate_partial_cleanup_failure) {
      throw new Error(
        "TASK-051 simulated partial cleanup failure after native release."
      );
    }

    const orderModule = container.resolve<IOrderModuleService>(Modules.ORDER);
    const order = await orderModule.retrieveOrder(input.order_id);
    const metadata =
      order.metadata && typeof order.metadata === "object"
        ? order.metadata
        : {};
    const updated = await orderModule.updateOrders(input.order_id, {
      metadata: {
        ...metadata,
        checkout_state: "expired",
        checkout_expiry_reason: "payment_timeout",
        checkout_expiry_cleanup: "complete",
      },
    });
    return new StepResponse(updated);
  }
);

export const expirePendingOrderWorkflow = createWorkflow(
  {
    name: "ft-007-expire-pending-order",
    idempotent: false,
  },
  (input: WorkflowData<ExpirePendingOrderWorkflowInput>) => {
    const lockKey = transform(input, (value) =>
      pendingOrderExpiryLockKey(value.order_id)
    );
    acquireLockStep({ key: lockKey, timeout: 5, retryInterval: 0.1, ttl: 120 });

    const candidate = loadExpiryCandidateStep(input);
    const canceled = when(
      "ft-007-cancel-expired-pending-order",
      { candidate },
      ({ candidate }) => candidate.action === "cancel"
    ).then(() =>
      cancelOrderWorkflow.runAsStep({
        input: { order_id: candidate.order.id },
      })
    );

    const cleanupPending = when(
      "ft-007-persist-expiry-cleanup-state",
      { candidate, canceled },
      ({ candidate }) => candidate.action !== "skip"
    ).then(() =>
      markExpiryCleanupPendingStep({
        order_id: candidate.order.id,
        metadata:
          candidate.order.metadata && typeof candidate.order.metadata === "object"
            ? candidate.order.metadata
            : {},
      })
    );

    const released = when(
      "ft-007-release-expired-order-reservations",
      { candidate, cleanupPending },
      ({ candidate }) =>
        candidate.action === "cleanup" && candidate.line_item_ids.length > 0
    ).then(() => deleteReservationsByLineItemsStep(candidate.line_item_ids));

    const cleanupComplete = when(
      "ft-007-complete-expiry-cleanup",
      { candidate, cleanupPending, released },
      ({ candidate }) => candidate.action !== "skip"
    ).then(() =>
      markExpiryCleanupCompleteStep({
        order_id: candidate.order.id,
        simulate_partial_cleanup_failure: transform(
          input,
          (value) => value.simulate_partial_cleanup_failure === true
        ),
      })
    );

    releaseLockStep({ key: lockKey });

    return new WorkflowResponse(
      transform(
        { candidate, cleanupComplete },
        ({ candidate, cleanupComplete }) => ({
          order_id: candidate.order.id,
          action: candidate.action,
          status: candidate.action === "skip" ? "unchanged" : "expired",
          reservations_released: candidate.action !== "skip",
          cleanup_state:
            candidate.action === "skip"
              ? "unchanged"
              : cleanupComplete
                ? "complete"
                : "pending",
        })
      )
    );
  }
);

export async function runExpirePendingOrderWorkflow(
  container: MedusaContainer,
  input: ExpirePendingOrderWorkflowInput
) {
  return expirePendingOrderWorkflow(container).run({ input });
}
