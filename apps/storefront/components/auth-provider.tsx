"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useCart } from "./cart-provider";
import { createStoreAuthClient, type StoreAuthClient } from "../lib/auth";
import {
  createAuthStateController,
  type AuthState,
  type AuthStateController,
} from "../lib/auth-state";

type AuthContextValue = {
  state: AuthState;
  startLogin: AuthStateController["startLogin"];
  restoreSession: AuthStateController["restoreSession"];
  logout: AuthStateController["logout"];
};

type AuthProviderProps = {
  children: ReactNode;
  client?: StoreAuthClient;
  restoreOnMount?: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  client,
  restoreOnMount = true,
}: AuthProviderProps) {
  const { clearLocalReference } = useCart();
  const controller = useMemo(
    () =>
      createAuthStateController({
        client: client ?? createStoreAuthClient(),
        clearLocalCartReference: clearLocalReference,
      }),
    [client, clearLocalReference]
  );
  const [state, setState] = useState<AuthState>(() => controller.getState());

  useEffect(() => controller.subscribe(setState), [controller]);

  useEffect(() => {
    if (restoreOnMount) {
      void controller.restoreSession();
    }
  }, [controller, restoreOnMount]);

  const value = useMemo(
    () => ({
      state,
      startLogin: controller.startLogin,
      restoreSession: controller.restoreSession,
      logout: controller.logout,
    }),
    [controller, state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}

export type { AuthContextValue };
