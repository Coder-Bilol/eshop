import { CheckoutAuthGate } from "../../components/checkout-auth-gate";
import { AuthenticatedCheckoutContinuation } from "../../components/checkout-form";

export default function CheckoutPage() {
  return (
    <>
      <CheckoutAuthGate />
      <AuthenticatedCheckoutContinuation />
    </>
  );
}
