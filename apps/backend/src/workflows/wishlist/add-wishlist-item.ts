import type { WorkflowData } from "@medusajs/framework/workflows-sdk";
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk";
import { addWishlistItem } from "../../wishlist/service";

export type AddWishlistItemInput = {
  customer_id: string;
  product_id: string;
  sales_channel_id: string;
};

const addWishlistItemStep = createStep(
  "wishlist-add-item",
  async (input: AddWishlistItemInput, { container }) => {
    const result = await addWishlistItem({
      scope: container,
      customerId: input.customer_id,
      productId: input.product_id,
      salesChannelId: input.sales_channel_id,
    });
    return new StepResponse(result);
  }
);

export const addWishlistItemWorkflow = createWorkflow(
  {
    name: "wishlist-add-item",
    idempotent: false,
  },
  (input: WorkflowData<AddWishlistItemInput>) =>
    new WorkflowResponse(addWishlistItemStep(input))
);
