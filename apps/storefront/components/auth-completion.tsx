"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { consumeReturnPath } from "../lib/auth";
import { CartMergeError } from "../lib/cart-merge";
import type { CartMergeAfterAuthenticationResult } from "./cart-provider";
import { useAuth } from "./auth-provider";
import { useCart } from "./cart-provider";

type CompletionSignal =
  | { kind: "success" }
  | { kind: "cancelled" }
  | { kind: "failure"; message: string };

type CompletionStatus =
  | "processing"
  | "cart_merge_pending"
  | "authenticated_ready"
  | "merge_blocked"
  | "auth_cancelled"
  | "auth_failed";

type CompletionView = {
  status: CompletionStatus;
  outcome: "merged" | "no_source" | null;
  message: string | null;
};

type CompletionController = ReturnType<typeof createAuthCompletionController>;

const SAFE_COMPLETION_FAILURES: Record<string, string> = {
  auth_account_link_required:
    "This sign-in method needs account linking before it can be used.",
  auth_email_required: "The provider did not return the information required to sign in.",
  auth_rate_limited: "Too many sign-in attempts. Wait a moment and try again.",
  auth_session_failed: "The customer session could not be established. Try again.",
  auth_failed: "Sign-in could not be completed. Try again.",
};

const initialView: CompletionView = {
  status: "processing",
  outcome: null,
  message: null,
};

export function readCompletionSignal(search: string, hash = ""): CompletionSignal {
  if (hash || search.length > 512) {
    return { kind: "failure", message: SAFE_COMPLETION_FAILURES.auth_failed };
  }

  const entries = Array.from(new URLSearchParams(search).entries());
  if (entries.length !== 2) {
    return { kind: "failure", message: SAFE_COMPLETION_FAILURES.auth_failed };
  }

  const providers = entries.filter(([name]) => name === "provider");
  const statuses = entries.filter(([name]) => name === "status");
  if (providers.length !== 1 || statuses.length !== 1) {
    return { kind: "failure", message: SAFE_COMPLETION_FAILURES.auth_failed };
  }

  const provider = providers[0][1];
  const status = statuses[0][1];
  if (provider !== "google" && provider !== "vkid") {
    return { kind: "failure", message: SAFE_COMPLETION_FAILURES.auth_failed };
  }
  if (status === "success") {
    return { kind: "success" };
  }
  if (status === "auth_callback_invalid") {
    return { kind: "cancelled" };
  }

  return {
    kind: "failure",
    message: SAFE_COMPLETION_FAILURES[status] || SAFE_COMPLETION_FAILURES.auth_failed,
  };
}

export async function resolveCartReadiness(
  mergeAfterAuthentication: () => Promise<CartMergeAfterAuthenticationResult>
) {
  const handoff = await mergeAfterAuthentication();

  if (!isRecord(handoff) || !isRecord(handoff.state)) {
    throw new Error("Cart readiness could not be confirmed.");
  }

  if (
    handoff.result === null &&
    (handoff.state.status === "idle" || handoff.state.status === "empty") &&
    handoff.state.operation === null &&
    handoff.state.cart === null &&
    handoff.state.error === null
  ) {
    return "no_source" as const;
  }

  const result = handoff.result;
  if (
    isRecord(result) &&
    isRecord(result.cart) &&
    isRecord(result.merge) &&
    isRecord(handoff.state.cart) &&
    handoff.state.status === "ready" &&
    handoff.state.operation === null &&
    handoff.state.error === null &&
    isNonEmptyString(result.merge.source_cart_id) &&
    isNonEmptyString(result.merge.target_cart_id) &&
    handoff.state.cart.id === result.merge.target_cart_id &&
    result.cart.id === result.merge.target_cart_id &&
    isCoherentMergeMetadata(result.merge)
  ) {
    return "merged" as const;
  }

  throw new Error("Cart readiness could not be confirmed.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function isCoherentMergeMetadata(merge: Record<string, unknown>) {
  const sourceId = merge.source_cart_id;
  const targetId = merge.target_cart_id;
  if (
    !isNonEmptyString(sourceId) ||
    !isNonEmptyString(targetId) ||
    typeof merge.replayed !== "boolean"
  ) {
    return false;
  }

  if (merge.outcome === "transferred") {
    return sourceId === targetId && merge.replayed === false;
  }
  if (merge.outcome === "merged") {
    return sourceId !== targetId && merge.replayed === false;
  }
  return merge.outcome === "already_merged" && merge.replayed === true;
}

export function consumeAuthenticatedReturnPath(
  status: CompletionStatus,
  sessionConfirmed: boolean,
  consume: () => string = consumeReturnPath
) {
  return status === "authenticated_ready" && sessionConfirmed ? consume() : null;
}

export function viewForMergeFailure(error: unknown): CompletionView {
  if (error instanceof CartMergeError && error.code === "cart_merge_auth_required") {
    return {
      status: "auth_failed",
      outcome: null,
      message: "The customer session could not be confirmed. Try again.",
    };
  }

  return {
    status: "merge_blocked",
    outcome: null,
    message: "Your session is active, but the saved cart could not be merged.",
  };
}

export function createAuthCompletionController(
  updateView: (view: CompletionView) => void
) {
  let mounted = false;
  let operation = 0;
  let attempted = false;
  let pending = false;

  function invalidate() {
    operation += 1;
    pending = false;
  }

  return {
    mount() {
      mounted = true;
      invalidate();
      attempted = false;
    },
    unmount() {
      mounted = false;
      invalidate();
      attempted = false;
    },
    isPending() {
      return pending;
    },
    resetForRetry() {
      if (!mounted || pending) {
        return false;
      }
      invalidate();
      attempted = false;
      updateView(initialView);
      return true;
    },
    authenticationLost() {
      if (!mounted) {
        return;
      }
      invalidate();
      attempted = true;
      updateView({
        status: "auth_failed",
        outcome: null,
        message: "The customer session could not be confirmed. Try again.",
      });
    },
    async startMerge(
      mergeAfterAuthentication: () => Promise<CartMergeAfterAuthenticationResult>
    ) {
      if (!mounted || attempted || pending) {
        return false;
      }

      attempted = true;
      pending = true;
      const currentOperation = ++operation;
      updateView({ status: "cart_merge_pending", outcome: null, message: null });

      let nextView: CompletionView;
      try {
        const outcome = await resolveCartReadiness(mergeAfterAuthentication);
        nextView = { status: "authenticated_ready", outcome, message: null };
      } catch (error) {
        nextView = viewForMergeFailure(error);
      }

      if (!mounted || currentOperation !== operation) {
        return false;
      }

      pending = false;
      updateView(nextView);
      return true;
    },
  };
}

export function AuthCompletion() {
  const { state: authState, restoreSession } = useAuth();
  const { mergeAfterAuthentication } = useCart();
  const [signal, setSignal] = useState<CompletionSignal | null>(null);
  const [view, setView] = useState<CompletionView>(initialView);
  const restoreObserved = useRef(false);
  const completionController = useRef<CompletionController | null>(null);
  const sessionRetry = useRef<Promise<unknown> | null>(null);
  const returnPathConsumed = useRef(false);

  if (!completionController.current) {
    completionController.current = createAuthCompletionController(setView);
  }

  useEffect(() => {
    const controller = completionController.current!;
    controller.mount();
    return () => controller.unmount();
  }, []);

  useLayoutEffect(() => {
    const nextSignal = readCompletionSignal(window.location.search, window.location.hash);
    window.history.replaceState(null, "", "/auth/complete");
    setSignal(nextSignal);
    if (nextSignal.kind === "cancelled") {
      setView({
        status: "auth_cancelled",
        outcome: null,
        message: "Sign-in was cancelled or expired. Your cart is still saved.",
      });
    } else if (nextSignal.kind === "failure") {
      setView({ status: "auth_failed", outcome: null, message: nextSignal.message });
    }
  }, []);

  useEffect(() => {
    if (signal?.kind !== "success") {
      return;
    }

    const controller = completionController.current!;

    if (
      (authState.status !== "session_established" || !authState.customer) &&
      controller.isPending()
    ) {
      controller.authenticationLost();
      return;
    }

    if (authState.status === "customer_resolving") {
      restoreObserved.current = true;
      setView(initialView);
      return;
    }

    if (authState.status === "session_established" && authState.customer) {
      void controller.startMerge(mergeAfterAuthentication);
      return;
    }

    if (authState.status === "auth_failed" || (restoreObserved.current && authState.status === "guest")) {
      setView({
        status: "auth_failed",
        outcome: null,
        message: "The customer session could not be confirmed. Try again.",
      });
    }
  }, [authState, mergeAfterAuthentication, signal]);

  useEffect(() => {
    if (returnPathConsumed.current) {
      return;
    }
    const returnPath = consumeAuthenticatedReturnPath(
      view.status,
      authState.status === "session_established" && Boolean(authState.customer)
    );
    if (returnPath === null) {
      return;
    }
    returnPathConsumed.current = true;
    window.location.replace(returnPath);
  }, [authState.customer, authState.status, view.status]);

  function retryMerge() {
    if (authState.status !== "session_established" || !authState.customer) {
      retrySession();
      return;
    }
    const controller = completionController.current!;
    if (controller.resetForRetry()) {
      void controller.startMerge(mergeAfterAuthentication);
    }
  }

  function retrySession() {
    if (sessionRetry.current) {
      return;
    }
    const controller = completionController.current!;
    if (!controller.resetForRetry()) {
      return;
    }
    restoreObserved.current = true;
    const pending = restoreSession();
    sessionRetry.current = pending;
    const clearPending = () => {
      if (sessionRetry.current === pending) {
        sessionRetry.current = null;
      }
    };
    void pending.then(clearPending, clearPending);
  }

  return (
    <main className="catalogShell" data-auth-completion-state={view.status}>
      <header className="catalogHeader">
        <div>
          <p className="eyebrow">Customer session</p>
          <h1>Completing sign-in</h1>
        </div>
      </header>

      {view.status === "processing" || view.status === "cart_merge_pending" ? (
        <section className="catalogState" role="status" data-auth-completion-pending="true">
          <h2>
            {view.status === "cart_merge_pending"
              ? "Preparing your saved cart"
              : "Confirming your session"}
          </h2>
          <p>Please keep this page open. Checkout remains paused until this finishes.</p>
        </section>
      ) : null}

      {view.status === "authenticated_ready" ? (
        <section className="catalogState" role="status" data-cart-readiness={view.outcome}>
          <h2>{view.outcome === "merged" ? "Cart ready" : "Sign-in complete"}</h2>
          <p>
            {view.outcome === "merged"
              ? "Your saved cart is ready. Continuing securely."
              : "There was no saved cart to merge. Continuing securely."}
          </p>
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

      {view.status === "auth_cancelled" || view.status === "auth_failed" ? (
        <section className="catalogState" role="alert" data-auth-completion-failure="safe">
          <h2>{view.status === "auth_cancelled" ? "Sign-in cancelled" : "Sign-in failed"}</h2>
          <p>{view.message}</p>
          {signal?.kind === "success" ? (
            <button className="addToCartButton" type="button" onClick={retrySession}>
              Retry session check
            </button>
          ) : (
            <a className="productDetailLink" href="/login">
              Try sign-in again
            </a>
          )}
        </section>
      ) : null}
    </main>
  );
}
