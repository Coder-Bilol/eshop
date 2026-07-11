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
  createStoreCartClient,
  type CartReferenceStorage,
  type StoreCartClient,
  type StoreCreateCartInput,
} from "../lib/cart";
import {
  createStoreCartMergeClient,
  mergeAuthenticatedCartReference,
  type StoreCartMergeClient,
  type StoreCartMergeResult,
} from "../lib/cart-merge";
import {
  createGuestCartStateController,
  type AddGuestCartItemInput,
  type GuestCartState,
  type GuestCartStateController,
  type RemoveGuestCartItemInput,
  type UpdateGuestCartItemInput,
} from "../lib/cart-state";

type CartContextValue = {
  state: GuestCartState;
  restore(): Promise<GuestCartState>;
  addItem(input: AddGuestCartItemInput): Promise<GuestCartState>;
  updateItem(input: UpdateGuestCartItemInput): Promise<GuestCartState>;
  removeItem(input: RemoveGuestCartItemInput): Promise<GuestCartState>;
  mergeAfterAuthentication(): Promise<CartMergeAfterAuthenticationResult>;
  clearLocalReference(): GuestCartState;
};

type CartMergeAfterAuthenticationResult = {
  result: StoreCartMergeResult | null;
  state: GuestCartState;
};

type CartProviderProps = {
  children: ReactNode;
  client?: StoreCartClient;
  mergeClient?: StoreCartMergeClient;
  storage?: CartReferenceStorage | null;
  createCartInput?: StoreCreateCartInput | (() => StoreCreateCartInput);
  restoreOnMount?: boolean;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  children,
  client,
  mergeClient,
  storage,
  createCartInput,
  restoreOnMount = true,
}: CartProviderProps) {
  const controller = useMemo(
    () =>
      createGuestCartStateController({
        client: client ?? createStoreCartClient(),
        storage,
        createCartInput,
      }),
    [client, storage, createCartInput]
  );
  const resolvedMergeClient = useMemo(
    () => mergeClient ?? createStoreCartMergeClient(),
    [mergeClient]
  );
  const [state, setState] = useState<GuestCartState>(() => controller.getState());

  useEffect(() => controller.subscribe(setState), [controller]);

  useEffect(() => {
    if (restoreOnMount) {
      void controller.restore();
    }
  }, [controller, restoreOnMount]);

  const mergeAfterAuthentication = useMemo(
    () => async (): Promise<CartMergeAfterAuthenticationResult> => {
      const result = await mergeAuthenticatedCartReference({
        client: resolvedMergeClient,
        storage,
      });
      const nextState = result ? await controller.restore() : controller.getState();

      return {
        result,
        state: nextState,
      };
    },
    [controller, resolvedMergeClient, storage]
  );

  const value = useMemo(
    () => ({
      state,
      restore: controller.restore,
      addItem: controller.addItem,
      updateItem: controller.updateItem,
      removeItem: controller.removeItem,
      mergeAfterAuthentication,
      clearLocalReference: controller.clearLocalReference,
    }),
    [controller, mergeAfterAuthentication, state]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider.");
  }
  return context;
}

export type {
  CartContextValue,
  CartMergeAfterAuthenticationResult,
  GuestCartStateController,
};
