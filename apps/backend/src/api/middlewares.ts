import {
  authenticate,
  defineMiddlewares,
} from "@medusajs/framework/http";

export default defineMiddlewares({
  routes: [
    {
      method: ["POST"],
      matcher: "/store/carts/:id/merge",
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
      ],
    },
  ],
});
