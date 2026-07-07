import { MedusaService } from "@medusajs/framework/utils";
import CartMerge from "./models/cart-merge";

class CartMergeModuleService extends MedusaService({
  CartMerge,
}) {}

export default CartMergeModuleService;
