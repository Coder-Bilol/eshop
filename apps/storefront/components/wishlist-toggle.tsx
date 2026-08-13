"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { writeReturnPath } from "../lib/auth";
import type { WishlistState } from "../lib/wishlist-state";
import { useAuth } from "./auth-provider";
import { useWishlist } from "./wishlist-provider";

export type WishlistControlState = "idle" | "pending" | "saved" | "error";

export const WISHLIST_LOGIN_LOCATION = "/login";

export function getWishlistControlState(
  productId: string,
  state: WishlistState,
  authenticated: boolean
): WishlistControlState {
  if (!authenticated) {
    return "idle";
  }
  if (state.pendingProductIds.includes(productId)) {
    return "pending";
  }
  if (state.errors[productId] || state.error) {
    return "error";
  }
  return state.items.some((item) => item.product_id === productId) ? "saved" : "idle";
}

export function currentWishlistReturnPath(
  location: Pick<Location, "pathname" | "search">
) {
  return `${location.pathname}${location.search}`;
}

export function routeGuestToLogin(
  location: Pick<Location, "pathname" | "search">,
  navigate: (location: string) => void
) {
  writeReturnPath(currentWishlistReturnPath(location));
  navigate(WISHLIST_LOGIN_LOCATION);
}

export function WishlistLoginLink({
  children,
  className = "productDetailLink",
}: {
  children: ReactNode;
  className?: string;
}) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    routeGuestToLogin(window.location, (location) => window.location.assign(location));
  }

  return (
    <a className={className} href={WISHLIST_LOGIN_LOCATION} onClick={handleClick}>
      {children}
    </a>
  );
}

export function WishlistToggle({
  productId,
  productTitle,
}: {
  productId: string;
  productTitle: string;
}) {
  if (typeof window === "undefined") {
    return <ServerWishlistToggle productId={productId} productTitle={productTitle} />;
  }

  const { state: authState } = useAuth();
  const { state, add, remove } = useWishlist();
  const observedCustomerId = useRef<string | null>(null);
  const authenticated =
    authState.status === "session_established" && Boolean(authState.customer?.id);
  const customerId = authState.customer?.id || null;
  useEffect(() => {
    if (authenticated && customerId && state.customerId === customerId) {
      observedCustomerId.current = customerId;
    }
  }, [authenticated, customerId, state.customerId]);

  const sessionExpired =
    authenticated &&
    state.status === "guest" &&
    observedCustomerId.current !== null;
  const itemSaved = state.items.some((item) => item.product_id === productId);
  const controlState = sessionExpired
    ? "error"
    : getWishlistControlState(productId, state, authenticated);
  const initialLoading = state.status === "loading";
  const authResolving =
    authState.status === "customer_resolving" || authState.status === "logging_out";
  const authBlocked =
    !authenticated &&
    authState.status !== "guest" &&
    authState.status !== "auth_failed";
  const pending = controlState === "pending";
  const disabled =
    pending ||
    initialLoading ||
    authResolving ||
    authBlocked ||
    (authenticated && state.status === "guest" && !sessionExpired);
  const productError = state.errors[productId] || state.error;

  async function toggle() {
    if (sessionExpired) {
      routeGuestToLogin(window.location, (location) => window.location.assign(location));
      return;
    }
    if (!authenticated || disabled) {
      if (
        !authenticated &&
        (authState.status === "guest" || authState.status === "auth_failed")
      ) {
        routeGuestToLogin(window.location, (location) => window.location.assign(location));
      }
      return;
    }

    if (itemSaved) {
      await remove(productId);
    } else {
      await add(productId);
    }
  }

  const label = sessionExpired
    ? `Sign in again to manage ${productTitle} in your wishlist`
    : controlState === "pending"
      ? itemSaved
        ? `Removing ${productTitle} from wishlist`
        : `Saving ${productTitle} to wishlist`
      : controlState === "saved"
        ? `Remove ${productTitle} from wishlist`
        : controlState === "error"
          ? itemSaved
            ? `Retry removing ${productTitle} from wishlist`
            : `Retry saving ${productTitle} to wishlist`
          : authenticated
            ? `Save ${productTitle} to wishlist`
            : `Sign in to save ${productTitle} to wishlist`;

  return (
    <div className="wishlistControl" data-wishlist-control={controlState}>
      <button
        className={controlState === "saved" ? "wishlistToggle saved" : "wishlistToggle"}
        type="button"
        aria-label={label}
        aria-pressed={itemSaved}
        aria-busy={pending}
        disabled={disabled}
        data-product-id={productId}
        data-wishlist-state={controlState}
        onClick={() => void toggle()}
      >
        {sessionExpired
          ? "Sign in again"
          : controlState === "pending"
          ? itemSaved
            ? "Removing..."
            : "Saving..."
          : controlState === "saved"
            ? "Saved"
            : controlState === "error"
              ? "Try again"
              : authenticated
                ? "Save to wishlist"
                : "Sign in to save"}
      </button>
      {productError ? (
        <p className="wishlistControlError" role="alert" data-wishlist-error="true">
          {productError.message}
        </p>
      ) : null}
    </div>
  );
}

function ServerWishlistToggle({
  productId,
  productTitle,
}: {
  productId: string;
  productTitle: string;
}) {
  return (
    <div className="wishlistControl" data-wishlist-control="idle">
      <button
        className="wishlistToggle"
        type="button"
        aria-label={`Sign in to save ${productTitle} to wishlist`}
        aria-pressed="false"
        disabled
        data-product-id={productId}
        data-wishlist-state="idle"
      >
        Sign in to save
      </button>
    </div>
  );
}
