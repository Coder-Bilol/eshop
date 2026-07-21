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
  ],
});
