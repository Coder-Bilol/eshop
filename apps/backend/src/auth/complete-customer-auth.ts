import type { AuthContext } from "@medusajs/framework/http";
import type {
  AuthIdentityDTO,
  AuthenticationInput,
  CustomerDTO,
  IAuthModuleService,
  ICustomerModuleService,
} from "@medusajs/framework/types";

import { withAuthCompletionLock } from "./rate-limit";

const PROVIDERS = ["google", "vkid"] as const;

export type CustomerAuthProvider = (typeof PROVIDERS)[number];

export type CompletionCode =
  | "auth_account_link_required"
  | "auth_callback_invalid"
  | "auth_email_required"
  | "auth_failed"
  | "auth_session_failed";

type CompletionAuthService = Pick<
  IAuthModuleService,
  "retrieveAuthIdentity" | "validateCallback"
>;
type CompletionCustomerService = Pick<
  ICustomerModuleService,
  "listCustomers" | "retrieveCustomer"
>;

type CustomerAuthCompletion = {
  authIdentity: AuthIdentityDTO;
  customer: CustomerDTO;
  created: boolean;
};

type CompletionDependencies = {
  authService: CompletionAuthService;
  createCustomerAccount: (input: {
    authIdentityId: string;
    customerData: {
      email: string;
      first_name?: string;
      last_name?: string;
    };
  }) => Promise<CustomerDTO>;
  customerService: CompletionCustomerService;
  establishSession: (completion: CustomerAuthCompletion) => Promise<void>;
  removeCustomerAccount: (customerId: string) => Promise<void>;
};

type CustomerSession = {
  auth_context?: AuthContext;
  destroy: (callback: (error?: unknown) => void) => void;
  regenerate: (callback: (error?: unknown) => void) => void;
  save: (callback: (error?: unknown) => void) => void;
};

export class CustomerAuthCompletionError extends Error {
  constructor(readonly code: CompletionCode) {
    super("Customer authentication could not be completed.");
  }
}

export const isCustomerAuthProvider = (
  value: string
): value is CustomerAuthProvider =>
  PROVIDERS.includes(value as CustomerAuthProvider);

const normalizeEmail = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    ? normalized
    : null;
};

const normalizeName = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized.slice(0, 100) : undefined;
};

const linkedCustomerId = (identity: AuthIdentityDTO) => {
  const value = identity.app_metadata?.customer_id;
  return typeof value === "string" && value ? value : null;
};

const providerMetadata = (
  identity: AuthIdentityDTO,
  provider: CustomerAuthProvider
) => {
  const matching = identity.provider_identities?.filter(
    (candidate) => candidate.provider === provider
  );

  if (matching?.length !== 1) {
    throw new CustomerAuthCompletionError("auth_callback_invalid");
  }

  return matching[0].user_metadata ?? {};
};

export const completeCustomerAuth = async (
  provider: CustomerAuthProvider,
  authenticationInput: AuthenticationInput,
  dependencies: CompletionDependencies
) => {
  const validated = await dependencies.authService.validateCallback(
    provider,
    authenticationInput
  );

  if (
    !validated.success ||
    !validated.authIdentity ||
    validated.mfaChallenge
  ) {
    throw new CustomerAuthCompletionError("auth_callback_invalid");
  }

  return withAuthCompletionLock(
    `identity\u0000${provider}\u0000${validated.authIdentity.id}`,
    async () => {
      const identity = await dependencies.authService.retrieveAuthIdentity(
        validated.authIdentity!.id,
        { relations: ["provider_identities"] }
      );
      const metadata = providerMetadata(identity, provider);
      const email = normalizeEmail(metadata.email);
      if (!email) {
        throw new CustomerAuthCompletionError("auth_email_required");
      }

      return withAuthCompletionLock(`email\u0000${email}`, async () => {
        const currentIdentity = await dependencies.authService.retrieveAuthIdentity(
          identity.id,
          { relations: ["provider_identities"] }
        );
        const existingCustomerId = linkedCustomerId(currentIdentity);

        if (existingCustomerId) {
          const customer = await dependencies.customerService.retrieveCustomer(
            existingCustomerId
          );
          const completion = {
            authIdentity: currentIdentity,
            customer,
            created: false,
          };
          await dependencies.establishSession(completion);
          return completion;
        }

        const collisions = await dependencies.customerService.listCustomers(
          { email },
          { take: 1 }
        );
        if (collisions.length) {
          throw new CustomerAuthCompletionError("auth_account_link_required");
        }

        const customer = await dependencies.createCustomerAccount({
          authIdentityId: currentIdentity.id,
          customerData: {
            email,
            first_name: normalizeName(metadata.first_name ?? metadata.given_name),
            last_name: normalizeName(metadata.last_name ?? metadata.family_name),
          },
        });

        try {
          const linkedIdentity = await dependencies.authService.retrieveAuthIdentity(
            currentIdentity.id,
            { relations: ["provider_identities"] }
          );

          if (linkedCustomerId(linkedIdentity) !== customer.id) {
            throw new CustomerAuthCompletionError("auth_failed");
          }

          const completion = {
            authIdentity: linkedIdentity,
            customer,
            created: true,
          };
          await dependencies.establishSession(completion);
          return completion;
        } catch (error) {
          await dependencies.removeCustomerAccount(customer.id);
          throw error instanceof CustomerAuthCompletionError
            ? error
            : new CustomerAuthCompletionError("auth_failed");
        }
      });
    }
  );
};

const sessionOperation = (
  operation: (callback: (error?: unknown) => void) => void
) =>
  new Promise<void>((resolve, reject) => {
    operation((error) => (error ? reject(error) : resolve()));
  });

export const establishCustomerSession = async (
  session: CustomerSession | undefined,
  provider: CustomerAuthProvider,
  authIdentity: AuthIdentityDTO,
  customer: CustomerDTO
) => {
  if (!session) {
    throw new CustomerAuthCompletionError("auth_session_failed");
  }

  try {
    await sessionOperation((callback) => session.regenerate(callback));
    session.auth_context = {
      actor_id: customer.id,
      actor_type: "customer",
      auth_identity_id: authIdentity.id,
      auth_provider: provider,
      app_metadata: { customer_id: customer.id },
      user_metadata: {},
    };
    await sessionOperation((callback) => session.save(callback));
  } catch {
    delete session.auth_context;
    try {
      await sessionOperation((callback) => session.destroy(callback));
    } catch {
      // The response still fails closed; no callback or token data is exposed.
    }
    throw new CustomerAuthCompletionError("auth_session_failed");
  }
};
