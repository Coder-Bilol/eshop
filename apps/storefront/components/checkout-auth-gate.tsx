"use client";

import { useEffect, useRef, useState } from "react";
import { writeReturnPath } from "../lib/auth";
import type { AuthState, AuthStatus } from "../lib/auth-state";
import type { GuestCartState } from "../lib/cart-state";
import { resolveCartReadiness } from "./auth-completion";
import { useAuth } from "./auth-provider";
import {
  useCart,
  type CartMergeAfterAuthenticationResult,
} from "./cart-provider";

export const CHECKOUT_RETURN_PATH = "/checkout";
export const CHECKOUT_LOGIN_LOCATION = "/login";

export type CheckoutGateStatus =
  | "checking_session"
  | AuthStatus
  | "callback_validating"
  | "cart_merge_pending"
  | "authenticated_ready"
  | "merge_blocked";

type CheckoutGateView = {
  status: CheckoutGateStatus;
  message: string | null;
};

type CheckoutGateAttempt = {
  customerId: string;
  restoreCart(): Promise<GuestCartState>;
  mergeAfterAuthentication(): Promise<CartMergeAfterAuthenticationResult>;
};

const initialView: CheckoutGateView = {
  status: "checking_session",
  message: null,
};

const BLOCKED_MESSAGE =
  "Your session is active, but the saved cart is not ready for checkout.";

export function canRenderCheckoutContinuation(status: CheckoutGateStatus) {
  return status === "authenticated_ready";
}

export function prepareCheckoutLogin(
  storeReturnPath: (value: unknown) => string = writeReturnPath
) {
  storeReturnPath(CHECKOUT_RETURN_PATH);
  return CHECKOUT_LOGIN_LOCATION;
}

export function classifyCheckoutCart(
  state: GuestCartState,
  customerId: string
): "authenticated_ready" | "merge_required" | "merge_blocked" {
  if (
    state.operation !== null ||
    state.error !== null ||
    !isNonEmptyId(customerId)
  ) {
    return "merge_blocked";
  }

  if (state.cart === null) {
    return state.status === "empty"
      ? "authenticated_ready"
      : "merge_blocked";
  }

  if (state.status !== "ready" && state.status !== "empty") {
    return "merge_blocked";
  }

  if (state.cart.customer_id === customerId) {
    return "authenticated_ready";
  }

  return state.cart.customer_id === null || state.cart.customer_id === undefined
    ? "merge_required"
    : "merge_blocked";
}

export async function resolveCheckoutMerge(
  mergeAfterAuthentication: CheckoutGateAttempt["mergeAfterAuthentication"],
  customerId: string
) {
  const handoff = await mergeAfterAuthentication();
  const outcome = await resolveCartReadiness(async () => handoff);

  if (outcome === "no_source") {
    return "authenticated_ready" as const;
  }

  if (handoff?.state.cart?.customer_id !== customerId) {
    throw new Error("Checkout cart ownership could not be confirmed.");
  }

  return "authenticated_ready" as const;
}

export function createCheckoutGateController(
  updateView: (view: CheckoutGateView) => void
) {
  let mounted = false;
  let operation = 0;
  let pending = false;
  let attemptedCustomerId: string | null = null;
  let lastAttempt: CheckoutGateAttempt | null = null;

  function invalidate() {
    operation += 1;
    pending = false;
  }

  async function start(attempt: CheckoutGateAttempt) {
    if (
      !mounted ||
      pending ||
      attemptedCustomerId === attempt.customerId ||
      !isNonEmptyId(attempt.customerId)
    ) {
      return false;
    }

    pending = true;
    attemptedCustomerId = attempt.customerId;
    lastAttempt = attempt;
    const currentOperation = ++operation;
    updateView({ status: "customer_resolving", message: null });

    let nextView: CheckoutGateView;
    try {
      const restored = await attempt.restoreCart();
      if (!mounted || currentOperation !== operation) {
        return false;
      }

      const readiness = classifyCheckoutCart(restored, attempt.customerId);
      if (readiness === "authenticated_ready") {
        nextView = { status: "authenticated_ready", message: null };
      } else if (readiness === "merge_required") {
        updateView({ status: "cart_merge_pending", message: null });
        await resolveCheckoutMerge(
          attempt.mergeAfterAuthentication,
          attempt.customerId
        );
        nextView = { status: "authenticated_ready", message: null };
      } else {
        nextView = { status: "merge_blocked", message: BLOCKED_MESSAGE };
      }
    } catch {
      nextView = { status: "merge_blocked", message: BLOCKED_MESSAGE };
    }

    if (!mounted || currentOperation !== operation) {
      return false;
    }

    pending = false;
    updateView(nextView);
    return true;
  }

  return {
    mount() {
      mounted = true;
      invalidate();
      attemptedCustomerId = null;
      lastAttempt = null;
    },
    unmount() {
      mounted = false;
      invalidate();
      attemptedCustomerId = null;
      lastAttempt = null;
    },
    blockForAuth(status: CheckoutGateStatus) {
      if (!mounted) {
        return;
      }
      invalidate();
      attemptedCustomerId = null;
      lastAttempt = null;
      updateView({ status, message: null });
    },
    start,
    retry() {
      if (!mounted || pending || !lastAttempt) {
        return false;
      }
      const attempt = lastAttempt;
      attemptedCustomerId = null;
      return start(attempt);
    },
  };
}

export function CheckoutAuthGate() {
  const { state: authState, restoreSession, logout } = useAuth();
  const { restore: restoreCart, mergeAfterAuthentication } = useCart();
  const [view, setView] = useState<CheckoutGateView>(initialView);
  const [sessionProbeComplete, setSessionProbeComplete] = useState(false);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const gateController = useRef<ReturnType<
    typeof createCheckoutGateController
  > | null>(null);
  const sessionProbe = useRef<Promise<AuthState> | null>(null);
  const mounted = useRef(false);
  const loginNavigationStarted = useRef(false);

  if (!gateController.current) {
    gateController.current = createCheckoutGateController(setView);
  }

  function probeSession() {
    if (sessionProbe.current) {
      return sessionProbe.current;
    }

    setSessionProbeComplete(false);
    gateController.current!.blockForAuth("checking_session");
    const pending = restoreSession();
    sessionProbe.current = pending;
    const complete = () => {
      if (sessionProbe.current === pending) {
        sessionProbe.current = null;
      }
      if (mounted.current) {
        setSessionProbeComplete(true);
      }
    };
    void pending.then(complete, complete);
    return pending;
  }

  useEffect(() => {
    mounted.current = true;
    gateController.current!.mount();
    void probeSession();

    return () => {
      mounted.current = false;
      gateController.current!.unmount();
    };
  }, []);

  useEffect(() => {
    if (!sessionProbeComplete) {
      return;
    }

    const controller = gateController.current!;
    if (authState.status === "session_established" && authState.customer) {
      void controller.start({
        customerId: authState.customer.id,
        restoreCart,
        mergeAfterAuthentication,
      });
      return;
    }

    controller.blockForAuth(authState.status);
    if (authState.status === "guest" && !loginNavigationStarted.current) {
      loginNavigationStarted.current = true;
      window.location.replace(prepareCheckoutLogin());
    }
  }, [
    authState,
    mergeAfterAuthentication,
    restoreCart,
    sessionProbeComplete,
  ]);

  const continuationAllowed = canRenderCheckoutContinuation(view.status);
  const retryMerge = () => {
    void gateController.current!.retry();
  };
  const confirmLogout = async () => {
    setLogoutFailed(false);
    try {
      await logout();
    } catch {
      setLogoutFailed(true);
    }
  };

  return (
    <main className="catalogShell" data-checkout-auth-state={view.status}>
      <header className="catalogHeader">
        <div>
          <p className="eyebrow">Secure checkout</p>
          <h1>Checkout readiness</h1>
        </div>
        <a className="productDetailLink" href="/cart">
          Back to cart
        </a>
      </header>

      {!continuationAllowed && view.status !== "merge_blocked" ? (
        <section className="catalogState" role="status">
          <h2>
            {view.status === "guest"
              ? "Sign-in required"
              : "Confirming your session and cart"}
          </h2>
          <p>Checkout remains paused until customer and cart readiness are confirmed.</p>
          {view.status === "auth_failed" ? (
            <button
              className="addToCartButton"
              type="button"
              onClick={() => void probeSession()}
            >
              Retry session check
            </button>
          ) : null}
        </section>
      ) : null}

      {view.status === "merge_blocked" ? (
        <section className="catalogState" role="alert" data-cart-readiness="blocked">
          <h2>Cart needs another attempt</h2>
          <p>{view.message}</p>
          <button className="addToCartButton" type="button" onClick={retryMerge}>
            Retry cart merge
          </button>
        </section>
      ) : null}

      {continuationAllowed ? (
        <section
          className="catalogState"
          role="status"
          data-checkout-continuation="ft-006-handoff"
        >
          <h2>Ready for checkout details</h2>
          <p>
            Your customer session and cart are ready. Delivery and payment details
            belong to the next checkout feature.
          </p>
          <p>
            This storefront gate does not replace customer authorization on backend
            checkout, order, or payment endpoints.
          </p>
          <button
            className="addToCartButton"
            type="button"
            disabled={authState.status === "logging_out"}
            onClick={() => void confirmLogout()}
          >
            {authState.status === "logging_out" ? "Signing out..." : "Log out"}
          </button>
          {logoutFailed ? (
            <p role="alert">Sign-out could not be confirmed. Try again.</p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

function isNonEmptyId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value === value.trim()
  );
}
