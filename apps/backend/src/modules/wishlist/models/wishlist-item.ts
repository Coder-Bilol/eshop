import { model } from "@medusajs/framework/utils";

const WishlistItem = model
  .define("wishlist_item", {
    id: model.id({ prefix: "witem" }).primaryKey(),
    customer_id: model.text(),
    product_id: model.text(),
  })
  .indexes([
    {
      name: "IDX_wishlist_item_customer_product_unique",
      on: ["customer_id", "product_id"],
      unique: true,
    },
    {
      name: "IDX_wishlist_item_customer_created_id",
      on: ["customer_id", "created_at", "id"],
    },
  ]);

export default WishlistItem;
