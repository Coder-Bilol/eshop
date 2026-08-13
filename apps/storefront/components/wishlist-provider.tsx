"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createStoreWishlistClient,
  type StoreWishlistClient,
} from "../lib/wishlist";
import {
  createWishlistStateController,
  type WishlistState,
  type WishlistStateController,
} from "../lib/wishlist-state";
import { useAuth } from "./auth-provider";

type WishlistContextValue = {
  state: WishlistState;
  load: WishlistStateController["load"];
  add: WishlistStateController["add"];
  remove: WishlistStateController["remove"];
};

type WishlistProviderProps = {
  children: ReactNode;
  client?: StoreWishlistClient;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children, client }: WishlistProviderProps) {
  const { state: authState } = useAuth();
  const resolvedClient = useMemo(
    () => client ?? createStoreWishlistClient(),
    [client]
  );
  const controller = useMemo(
    () => createWishlistStateController({ client: resolvedClient }),
    [resolvedClient]
  );
  const [state, setState] = useState<WishlistState>(() => controller.getState());
  const customerId = authState.customer?.id ?? null;

  useEffect(() => controller.subscribe(setState), [controller]);

  useEffect(() => {
    if (authState.status === "session_established" && customerId) {
      void controller.load(customerId);
      return;
    }

    // Keep confirmed data while logout or current-customer resolution is pending.
    // AuthProvider clears its customer association only after the backend transition.
    if (
      (authState.status === "customer_resolving" && controller.getState().customerId) ||
      (authState.status === "logging_out" && authState.customer)
    ) {
      return;
    }

    controller.clear();
  }, [authState.customer, authState.status, controller, customerId]);

  const value = useMemo(
    () => ({
      state,
      load: controller.load,
      add: controller.add,
      remove: controller.remove,
    }),
    [controller, state]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within WishlistProvider.");
  }
  return context;
}

export type { WishlistContextValue };
