import {
  normalizeAndValidateCheckout,
  type StoreCheckoutInput,
} from "../../../checkout/validation";

export type { StoreCheckoutInput } from "../../../checkout/validation";

export function parseStoreCheckoutBody(body: unknown): StoreCheckoutInput {
  return normalizeAndValidateCheckout(body);
}
