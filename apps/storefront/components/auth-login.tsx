"use client";

import { useState } from "react";
import type { AuthClientErrorCode, CustomerAuthProvider } from "../lib/auth";
import { useAuth } from "./auth-provider";

type AuthLoginProps = {
  returnPath?: string;
};

const AUTH_FAILURE_MESSAGES: Partial<Record<AuthClientErrorCode, string>> = {
  auth_rate_limited: "Too many sign-in attempts. Wait a moment and try again.",
  auth_network_error: "The sign-in service could not be reached. Try again.",
  auth_backend_unavailable: "Sign-in is temporarily unavailable. Try again.",
  auth_invalid_response: "Sign-in could not be started safely. Try again.",
};

export function createExclusiveAction() {
  let pending = false;

  return {
    async run(action: () => Promise<void>) {
      if (pending) {
        return false;
      }
      pending = true;
      try {
        await action();
        return true;
      } finally {
        pending = false;
      }
    },
  };
}

export function safeAuthFailureMessage(code?: AuthClientErrorCode) {
  return (
    (code ? AUTH_FAILURE_MESSAGES[code] : undefined) ||
    "Sign-in could not be started. Try again."
  );
}

export function AuthLogin({ returnPath = "/" }: AuthLoginProps) {
  const { state, startLogin } = useAuth();
  const [activeProvider, setActiveProvider] = useState<CustomerAuthProvider | null>(
    null
  );
  const [navigationFailed, setNavigationFailed] = useState(false);
  const [loginAction] = useState(createExclusiveAction);
  const pending =
    state.status === "auth_starting" || state.status === "provider_pending";
  const failed = state.status === "auth_failed" || navigationFailed;

  async function chooseProvider(provider: CustomerAuthProvider) {
    if (pending) {
      return;
    }

    await loginAction.run(async () => {
      setActiveProvider(provider);
      setNavigationFailed(false);
      try {
        const location = await startLogin(provider, returnPath);
        window.location.assign(location);
      } catch {
        setActiveProvider(null);
        setNavigationFailed(true);
      }
    });
  }

  return (
    <main className="catalogShell" data-auth-login-state={failed ? "auth_failed" : state.status}>
      <header className="catalogHeader">
        <div>
          <p className="eyebrow">Secure checkout</p>
          <h1>Sign in before checkout</h1>
        </div>
        <a className="productDetailLink" href="/">
          Back to catalog
        </a>
      </header>

      <section className="catalogState" aria-labelledby="login-options-heading">
        <h2 id="login-options-heading">Choose a sign-in provider</h2>
        <p>Google and VK ID use the same secure customer session flow.</p>
        <div className="cartAction">
          <button
            className="addToCartButton"
            type="button"
            disabled={pending}
            onClick={() => void chooseProvider("google")}
          >
            {pending && activeProvider === "google" ? "Opening Google..." : "Google"}
          </button>
          <button
            className="addToCartButton"
            type="button"
            disabled={pending}
            onClick={() => void chooseProvider("vkid")}
          >
            {pending && activeProvider === "vkid" ? "Opening VK ID..." : "VK ID"}
          </button>
        </div>
      </section>

      {pending ? (
        <section className="catalogState" role="status" data-auth-pending="true">
          <h2>Connecting to the provider</h2>
          <p>Complete sign-in in the provider window. Your cart stays saved.</p>
        </section>
      ) : null}

      {failed ? (
        <section className="catalogState" role="alert" data-auth-failure="safe">
          <h2>Sign-in did not start</h2>
          <p>{safeAuthFailureMessage(state.error?.code)}</p>
          <p>Select Google or VK ID to retry.</p>
        </section>
      ) : null}
    </main>
  );
}
