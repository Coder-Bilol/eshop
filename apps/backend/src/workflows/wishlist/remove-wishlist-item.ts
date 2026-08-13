import type { WorkflowData } from "@medusajs/framework/workflows-sdk";
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk";
import { removeWishlistItem } from "../../wishlist/service";

export type RemoveWishlistItemInput = {
  customer_id: string;
  product_id: string;
};

const removeWishlistItemStep = createStep(
  "wishlist-remove-item",
  async (input: RemoveWishlistItemInput, { container }) => {
    const result = await removeWishlistItem({
      scope: container,
      customerId: input.customer_id,
      productId: input.product_id,
    });
    return new StepResponse(result);
  }
);

export const removeWishlistItemWorkflow = createWorkflow(
  {
    name: "wishlist-remove-item",
    idempotent: false,
  },
  (input: WorkflowData<RemoveWishlistItemInput>) =>
    new WorkflowResponse(removeWishlistItemStep(input))
);
