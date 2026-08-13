import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import { addWishlistItemWorkflow } from "../../../../workflows/wishlist/add-wishlist-item";
import {
  customerActorId,
  requestSalesChannelId,
  sendWishlistError,
} from "../route";
import { parseStoreWishlistItemBody } from "../validators";

export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  try {
    const customerId = customerActorId(req);
    const input = parseStoreWishlistItemBody(req.validatedBody ?? req.body);
    const { result } = await addWishlistItemWorkflow(req.scope).run({
      input: {
        customer_id: customerId,
        product_id: input.product_id,
        sales_channel_id: requestSalesChannelId(req),
      },
    });

    res.status(result.created ? 201 : 200).json(result);
  } catch (error) {
    sendWishlistError(res, error);
  }
}
