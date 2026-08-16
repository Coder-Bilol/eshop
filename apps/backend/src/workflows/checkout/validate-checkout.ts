import type { WorkflowData } from "@medusajs/framework/workflows-sdk";
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk";

import {
  resolveCheckoutDeliveryOptions,
  type CheckoutDeliveryOption,
} from "../../checkout/delivery-options";
import type {
  PaymentId,
  StoreCheckoutInput,
} from "../../checkout/validation";

export type ValidateCheckoutInput = {
  customer_id: string;
  checkout: StoreCheckoutInput;
};

export type ValidatedCheckoutSnapshot = {
  customer_id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  address?: string;
  comment?: string;
  delivery_method: StoreCheckoutInput["delivery_method"];
  tariff: NonNullable<CheckoutDeliveryOption["tariff"]>;
};

export type ValidateCheckoutResult = {
  snapshot: ValidatedCheckoutSnapshot;
  payment_id: PaymentId;
};

export class CheckoutDeliveryUnavailableError extends Error {
  readonly statusCode = 422;
  readonly code = "delivery_method_unavailable" as const;
  readonly details: Record<string, unknown>;

  constructor(deliveryMethod: StoreCheckoutInput["delivery_method"]) {
    super("Selected delivery method is unavailable.");
    this.name = "CheckoutDeliveryUnavailableError";
    this.details = { delivery_method: deliveryMethod };
  }
}

const validateCheckoutStep = createStep(
  "checkout-validate-transient-snapshot",
  async (
    input: ValidateCheckoutInput,
    { container }
  ): Promise<StepResponse<ValidateCheckoutResult>> => {
    const options = await resolveCheckoutDeliveryOptions(container);
    const selected = options.find(
      (option) => option.id === input.checkout.delivery_method
    );

    if (!selected?.available || !selected.tariff) {
      throw new CheckoutDeliveryUnavailableError(
        input.checkout.delivery_method
      );
    }

    return new StepResponse({
      snapshot: {
        customer_id: input.customer_id,
        name: input.checkout.name,
        email: input.checkout.email,
        phone: input.checkout.phone,
        city: input.checkout.city,
        ...(input.checkout.address ? { address: input.checkout.address } : {}),
        ...(input.checkout.comment ? { comment: input.checkout.comment } : {}),
        delivery_method: input.checkout.delivery_method,
        tariff: selected.tariff,
      },
      payment_id: input.checkout.payment_method,
    });
  }
);

export const validateCheckoutWorkflow = createWorkflow(
  {
    name: "checkout-validate-transient-snapshot",
    idempotent: false,
  },
  (input: WorkflowData<ValidateCheckoutInput>) =>
    new WorkflowResponse(validateCheckoutStep(input))
);
