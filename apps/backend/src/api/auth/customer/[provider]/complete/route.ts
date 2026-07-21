import {
  createCustomerAccountWorkflow,
  removeCustomerAccountWorkflow,
} from "@medusajs/core-flows";
import type {
  AuthenticationInput,
  IAuthModuleService,
  ICustomerModuleService,
} from "@medusajs/framework/types";
import type {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";

import {
  completeCustomerAuth,
  CustomerAuthCompletionError,
  establishCustomerSession,
  isCustomerAuthProvider,
  type CompletionCode,
  type CustomerAuthProvider,
} from "../../../../../auth/complete-customer-auth";
import {
  claimOAuthCallback,
  consumeAuthRateLimit,
} from "../../../../../auth/rate-limit";

const COMPLETION_PATH = "/auth/complete";

const clientAddress = (req: MedusaRequest) =>
  req.ip || req.socket.remoteAddress || "unknown";

const callbackState = (req: MedusaRequest) => {
  const queryState = req.query.state;
  const body = req.body as Record<string, unknown> | undefined;
  const value = queryState ?? body?.state;
  return typeof value === "string" ? value : "";
};

export const completionRedirect = (
  storeCors: string,
  provider: CustomerAuthProvider,
  status: "success" | CompletionCode | "auth_rate_limited"
) => {
  const origin = storeCors.split(",")[0]?.trim();
  const parsed = new URL(origin);
  if (parsed.origin !== origin || !["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("A fixed storefront origin is required for auth completion.");
  }

  const destination = new URL(COMPLETION_PATH, parsed.origin);
  destination.searchParams.set("provider", provider);
  destination.searchParams.set("status", status);
  return destination.toString();
};

const safeCode = (error: unknown): CompletionCode =>
  error instanceof CustomerAuthCompletionError ? error.code : "auth_failed";

const redirect = (
  res: MedusaResponse,
  storeCors: string,
  provider: CustomerAuthProvider,
  status: "success" | CompletionCode | "auth_rate_limited"
) => res.redirect(302, completionRedirect(storeCors, provider, status));

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const providerValue = req.params.provider;
  const provider: CustomerAuthProvider = isCustomerAuthProvider(providerValue)
    ? providerValue
    : "google";
  const config = req.scope.resolve(ContainerRegistrationKeys.CONFIG_MODULE);
  const storeCors = config.projectConfig.http.storeCors;

  if (!isCustomerAuthProvider(providerValue)) {
    return redirect(res, storeCors, provider, "auth_callback_invalid");
  }

  if (
    !consumeAuthRateLimit(
      "complete",
      provider,
      clientAddress(req)
    )
  ) {
    return redirect(res, storeCors, provider, "auth_rate_limited");
  }

  const state = callbackState(req);
  if (!state || !claimOAuthCallback(provider, state)) {
    return redirect(res, storeCors, provider, "auth_callback_invalid");
  }

  try {
    const authService = req.scope.resolve<IAuthModuleService>(Modules.AUTH);
    const customerService =
      req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER);
    await completeCustomerAuth(
      provider,
      {
        actor_type: "customer",
        url: req.url,
        headers: req.headers,
        query: req.query,
        body: req.body,
        protocol: req.protocol,
      } as AuthenticationInput,
      {
        authService,
        customerService,
        createCustomerAccount: async (input) => {
          const { result: customer } = await createCustomerAccountWorkflow(
            req.scope
          ).run({ input });
          return customer;
        },
        establishSession: (completion) =>
          establishCustomerSession(
            req.session,
            provider,
            completion.authIdentity,
            completion.customer
          ),
        removeCustomerAccount: async (customerId) => {
          await removeCustomerAccountWorkflow(req.scope).run({
            input: { customerId },
          });
        },
      }
    );
    return redirect(res, storeCors, provider, "success");
  } catch (error) {
    return redirect(res, storeCors, provider, safeCode(error));
  }
};

export const POST = GET;
