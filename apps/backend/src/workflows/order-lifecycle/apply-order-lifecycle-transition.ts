import type { IOrderModuleService, MedusaContainer } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  type WorkflowData,
} from "@medusajs/framework/workflows-sdk";
import { loadNativeLifecycleOrder, nativeLifecycleSnapshot } from "../../order-lifecycle/native-order";
import { projectOrderLifecycle } from "../../order-lifecycle/projection";
import type {
  LifecycleProjectionResult,
} from "../../order-lifecycle/types";

export type ApplyOrderLifecycleTransitionInput = {
  event: unknown;
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
    const order = await loadNativeLifecycleOrder(container, event.order_id);
    const snapshot = nativeLifecycleSnapshot(order);

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
    const projected = loadAndProjectStep(input);
    return new WorkflowResponse(projected);
  }
);

export async function runApplyOrderLifecycleTransition(
  container: MedusaContainer,
  input: ApplyOrderLifecycleTransitionInput
) {
  return applyOrderLifecycleTransition(container).run({ input });
}
