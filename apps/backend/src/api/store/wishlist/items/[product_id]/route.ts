import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import { removeWishlistItemWorkflow } from "../../../../../workflows/wishlist/remove-wishlist-item";
import {
  customerActorId,
  sendWishlistError,
} from "../../route";
import { parseWishlistProductId } from "../../validators";

export async function DELETE(
  req: AuthenticatedMedusaRequest & { params: { product_id?: string } },
  res: MedusaResponse
) {
  try {
    const customerId = customerActorId(req);
    const productId = parseWishlistProductId(req.params?.product_id);
    const { result } = await removeWishlistItemWorkflow(req.scope).run({
      input: {
        customer_id: customerId,
        product_id: productId,
      },
    });

    res.json(result);
  } catch (error) {
    sendWishlistError(res, error);
  }
}
