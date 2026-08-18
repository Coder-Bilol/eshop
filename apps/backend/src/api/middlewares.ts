import {
  authenticate,
  defineMiddlewares,
} from "@medusajs/framework/http";
import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";

import { consumeAuthRateLimit } from "../auth/rate-limit";

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
  ],
});
