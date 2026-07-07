import { model } from "@medusajs/framework/utils";

const CartMerge = model
  .define("cart_merge", {
    id: model.id({ prefix: "cmerge" }).primaryKey(),
    source_cart_id: model.text().unique(),
    target_cart_id: model.text(),
    customer_id: model.text(),
    mode: model.enum(["ownership_transfer", "merge_into_existing"]),
    status: model.enum(["pending", "completed", "failed"]).default("pending"),
    plan: model.json(),
    failure_code: model.text().nullable(),
    attempt_count: model.number().default(1),
    completed_at: model.dateTime().nullable(),
  })
  .indexes([
    {
      name: "IDX_cart_merge_customer_status",
      on: ["customer_id", "status"],
    },
    {
      name: "IDX_cart_merge_target_cart_id",
      on: ["target_cart_id"],
    },
  ]);

export default CartMerge;
