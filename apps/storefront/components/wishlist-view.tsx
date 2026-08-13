"use client";

import { useEffect, useRef } from "react";
import { formatCatalogMoney } from "../lib/catalog";
import { WishlistLoginLink, WishlistToggle } from "./wishlist-toggle";
import { useAuth } from "./auth-provider";
import { useWishlist } from "./wishlist-provider";

export function WishlistView() {
  const { state: authState } = useAuth();
  const { state, load } = useWishlist();
  const customerId = authState.customer?.id || null;
  const authenticated =
    authState.status === "session_established" && Boolean(customerId);
  const hadWishlistSession = useRef(false);

  useEffect(() => {
    if (authenticated && customerId && state.customerId === customerId) {
      hadWishlistSession.current = true;
    }
  }, [authenticated, customerId, state.customerId]);

  if (authState.status === "guest" || authState.status === "auth_failed") {
    return (
      <main className="wishlistShell" data-wishlist-page-state="guest">
        <WishlistHeader />
        <section className="wishlistState" role="status">
          <p className="sectionLabel">Your favorites</p>
          <h1>Sign in to view your wishlist</h1>
          <p>Wishlist items are available only in your customer account.</p>
          <WishlistLoginLink>Sign in</WishlistLoginLink>
        </section>
      </main>
    );
  }

  if (!authenticated || authState.status === "customer_resolving") {
    return <WishlistLoading />;
  }

  if (state.status === "guest") {
    if (hadWishlistSession.current) {
      return (
        <main className="wishlistShell" data-wishlist-page-state="session-expired">
          <WishlistHeader />
          <section className="wishlistState" role="alert">
            <p className="sectionLabel">Session expired</p>
            <h1>Sign in again to view your wishlist</h1>
            <p>Your saved products are still safe in your account.</p>
            <WishlistLoginLink>Sign in again</WishlistLoginLink>
          </section>
        </main>
      );
    }
    return <WishlistLoading />;
  }

  if (state.status === "loading") {
    return <WishlistLoading />;
  }

  if (state.status === "error") {
    return (
      <main className="wishlistShell" data-wishlist-page-state="error">
        <WishlistHeader />
        <section className="wishlistState" role="alert">
          <p className="sectionLabel">Your favorites</p>
          <h1>Wishlist could not be loaded</h1>
          <p>{state.error?.message || "Try again in a moment."}</p>
          <button
            className="wishlistAction"
            type="button"
            onClick={() => void load(customerId!)}
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  return (
    <main
      className="wishlistShell"
      data-wishlist-page-state={state.items.length ? "products" : "empty"}
    >
      <WishlistHeader />
      {state.items.length === 0 ? (
        <section className="wishlistState" role="status">
          <p className="sectionLabel">Your favorites</p>
          <h1>Your wishlist is empty</h1>
          <p>Save a product from the catalog or its detail page to find it here.</p>
          <a className="productDetailLink" href="/">
            Browse catalog
          </a>
        </section>
      ) : (
        <section className="wishlistProducts" aria-label="Wishlist products">
          <div className="wishlistProductsHeader">
            <div>
              <p className="sectionLabel">Your favorites</p>
              <h1>Wishlist</h1>
            </div>
            <p className="wishlistCount">{state.items.length} products</p>
          </div>
          <div className="wishlistGrid">
            {state.items.map(({ product }) => (
              <article className="wishlistCard" data-product-id={product.id} key={product.id}>
                {product.thumbnail ? (
                  <img
                    className="wishlistThumbnail"
                    src={product.thumbnail}
                    alt={product.title}
                  />
                ) : (
                  <div className="wishlistThumbnailFallback" aria-hidden="true">
                    {product.category.name}
                  </div>
                )}
                <div className="wishlistCardBody">
                  <p className="productCategory">{product.category.name}</p>
                  <h2>
                    <a href={`/products/${encodeURIComponent(product.handle)}`}>
                      {product.title}
                    </a>
                  </h2>
                  <p className="productPrice">
                    {product.price
                      ? formatCatalogMoney(product.price.amount, product.price.currency_code)
                      : "Price unavailable"}
                  </p>
                  <p
                    className={
                      product.is_available
                        ? "wishlistAvailability"
                        : "wishlistAvailability unavailable"
                    }
                  >
                    {product.is_available ? "Available" : "Currently unavailable"}
                  </p>
                  <WishlistToggle productId={product.id} productTitle={product.title} />
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function WishlistHeader() {
  return (
    <header className="wishlistHeader">
      <div>
        <p className="eyebrow">Eshop favorites</p>
        <p className="wishlistHeaderNote">Product-level saves, kept in your account.</p>
      </div>
      <a className="productDetailLink" href="/">
        Back to catalog
      </a>
    </header>
  );
}

function WishlistLoading() {
  return (
    <main className="wishlistShell" data-wishlist-page-state="loading">
      <WishlistHeader />
      <section className="wishlistState" role="status" aria-busy="true">
        <p className="sectionLabel">Your favorites</p>
        <h1>Loading wishlist</h1>
        <p>Checking your customer session and saved products.</p>
      </section>
    </main>
  );
}
