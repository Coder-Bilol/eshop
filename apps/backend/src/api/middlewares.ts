import {
  authenticate,
  defineMiddlewares,
} from "@medusajs/framework/http";
import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";

import { consumeAuthRateLimit } from "../auth/rate-limit";
import {
  assertNativeLifecyclePrecondition,
  loadNativeLifecycleOrder,
  type LifecycleOperation,
} from "../order-lifecycle/native-order";

const PROTECTED_WORKFLOW_METADATA_KEYS = [
  "checkout_state",
  "pending_payment_expires_at",
  "checkout_cart_id",
  "checkout_idempotency_key",
  "checkout_request_fingerprint",
  "checkout_delivery_method",
  "checkout_payment_method",
  "checkout_customer_comment",
  "checkout_managed_line_count",
  "checkout_reservation_item_ids",
  "checkout_reservation_line_ids",
  "checkout_expiry_origin",
  "checkout_expiry_reason",
  "checkout_expiry_cleanup",
] as const;

const lifecycleAdminGuard = (operation: LifecycleOperation) =>
  async (
    req: MedusaRequest,
    _res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    const orderId = await resolveLifecycleOrderId(req);
    const order = await loadNativeLifecycleOrder(req.scope, orderId);
    const path = req.path || req.originalUrl || "";
    if (path.includes("payment-collections") || path.includes("/payments/")) {
      const bound = (order.payment_collections ?? []).some((collection) =>
        path.includes("payment-collections")
          ? collection.id === req.params.id
          : collection.payments?.some((payment) => payment.id === req.params.id)
      );
      const requestedOrder = (req.body as any)?.order_id;
      if (!bound || (requestedOrder !== undefined && requestedOrder !== orderId)) {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "The lifecycle payment is not bound to this order.");
      }
    }
    assertNativeLifecyclePrecondition(order, operation);
    if (operation === "metadata") {
      assertProtectedMetadataUpdate(order.metadata, (req.body as any)?.metadata);
    }
    next();
  };

async function resolveLifecycleOrderId(req: MedusaRequest): Promise<string> {
  const params = req.params as Record<string, string | undefined>;
  if (typeof params.id !== "string" || params.id.trim() === "") {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "The lifecycle operation must identify an order."
    );
  }

  const path = req.path || req.originalUrl || "";
  if (!path.includes("payment-collections") && !path.includes("/payments/")) {
    return params.id;
  }

  const query = req.scope.resolve<any>(ContainerRegistrationKeys.QUERY);
  const filterKey = path.includes("payment-collections")
    ? "payment_collections.id"
    : "payment_collections.payments.id";
  const result = await query.graph({
    entity: "order",
    fields: ["id", "payment_collections.id"],
    filters: { [filterKey]: params.id },
    options: { limit: 1 },
  });
  const orderId = result?.data?.[0]?.id;
  if (typeof orderId !== "string") {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "The lifecycle operation is not bound to an order."
    );
  }
  return orderId;
}

function assertProtectedMetadataUpdate(
  currentMetadata: unknown,
  submittedMetadata: unknown
): void {
  if (submittedMetadata === undefined) return;
  if (
    typeof submittedMetadata !== "object" ||
    submittedMetadata === null ||
    Array.isArray(submittedMetadata)
  ) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Order workflow metadata must be preserved as an object."
    );
  }

  const current =
    currentMetadata && typeof currentMetadata === "object"
      ? (currentMetadata as Record<string, unknown>)
      : {};
  const submitted = submittedMetadata as Record<string, unknown>;
  for (const key of PROTECTED_WORKFLOW_METADATA_KEYS) {
    const hasCurrent = Object.prototype.hasOwnProperty.call(current, key);
    const hasSubmitted = Object.prototype.hasOwnProperty.call(submitted, key);
    if (
      hasCurrent !== hasSubmitted ||
      (hasCurrent && !sameValue(current[key], submitted[key]))
    ) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Workflow-owned order metadata key '${key}' cannot be changed or deleted.`
      );
    }
  }
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

const hasCallbackUrl = (value: unknown) =>
  typeof value === "object" &&
  value !== null &&
  Object.prototype.hasOwnProperty.call(value, "callback_url");

const rejectGoogleCallbackUrlOverride = (
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) => {
  if (hasCallbackUrl(req.body) || hasCallbackUrl(req.query)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "OAuth callback URL overrides are not allowed."
    );
  }

  next();
};

const authStartRateLimit = (provider: "google" | "vkid") =>
  (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const address = req.ip || req.socket.remoteAddress || "unknown";
    if (!consumeAuthRateLimit("start", provider, address)) {
      res.status(429).json({
        code: "auth_rate_limited",
        message: "Authentication is temporarily unavailable.",
      });
      return;
    }

    next();
  };

const standardCheckoutAuthentication = authenticate("customer", [
  "session",
  "bearer",
]);

const checkoutAuthentication = async (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const response = res as MedusaResponse & {
    json: (body?: unknown) => MedusaResponse;
  };
  const originalJson = response.json;
  let restored = false;

  const restoreJson = () => {
    if (!restored) {
      response.json = originalJson;
      restored = true;
    }
  };

  response.json = ((body?: unknown) => {
    if (response.statusCode === 401 && isNativeUnauthorizedResponse(body)) {
      return originalJson.call(response, {
        error: {
          code: "checkout_auth_required",
          message: "Authentication is required to continue checkout.",
          details: {},
        },
      });
    }

    return originalJson.call(response, body);
  }) as typeof response.json;

  try {
    await standardCheckoutAuthentication(req, response, (error?: unknown) => {
      restoreJson();
      next(error);
    });
  } finally {
    restoreJson();
  }
};

function isNativeUnauthorizedResponse(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    !Array.isArray(body) &&
    Object.keys(body).length === 1 &&
    (body as { message?: unknown }).message === "Unauthorized"
  );
}

export default defineMiddlewares({
  routes: [
    {
      method: ["GET", "POST"],
      matcher: "/auth/customer/google",
      middlewares: [authStartRateLimit("google"), rejectGoogleCallbackUrlOverride],
    },
    {
      method: ["GET", "POST"],
      matcher: "/auth/customer/vkid",
      middlewares: [authStartRateLimit("vkid")],
    },
    {
      method: ["POST"],
      matcher: "/store/carts/:id/merge",
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
      ],
    },
    {
      method: ["POST"],
      matcher: "/store/checkout",
      middlewares: [checkoutAuthentication],
    },
    {
      method: ["POST"],
      matcher: "/store/checkout/order",
      middlewares: [checkoutAuthentication],
    },
    {
      method: ["GET"],
      matcher: "/store/wishlist",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      method: ["POST"],
      matcher: "/store/wishlist/items",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      method: ["DELETE"],
      matcher: "/store/wishlist/items/:product_id",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      method: ["POST"],
      matcher: "/admin/payment-collections/:id/mark-as-paid",
      middlewares: [lifecycleAdminGuard("payment")],
    },
    {
      method: ["POST"],
      matcher: "/admin/orders/:id/cancel",
      middlewares: [lifecycleAdminGuard("cancel")],
    },
    {
      method: ["POST"],
      matcher: "/admin/orders/:id/fulfillments",
      middlewares: [lifecycleAdminGuard("fulfillment")],
    },
    {
      method: ["POST"],
      matcher: "/admin/orders/:id/fulfillments/:fulfillment_id/cancel",
      middlewares: [lifecycleAdminGuard("fulfillment")],
    },
    {
      method: ["POST"],
      matcher: "/admin/orders/:id/complete",
      middlewares: [lifecycleAdminGuard("complete")],
    },
    {
      method: ["POST"],
      matcher: "/admin/payments/:id/refund",
      middlewares: [lifecycleAdminGuard("refund")],
    },
    {
      method: ["POST"],
      matcher: "/admin/orders/:id",
      middlewares: [lifecycleAdminGuard("metadata")],
    },
  ],
});
