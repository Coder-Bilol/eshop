import {
  AuthClientError,
  clearReturnPath,
  writeReturnPath,
  type AuthClientErrorCode,
  type AuthCustomer,
  type CustomerAuthProvider,
  type StoreAuthClient,
} from "./auth";

export type AuthStatus =
  | "guest"
  | "auth_starting"
  | "provider_pending"
  | "customer_resolving"
  | "session_established"
  | "auth_failed"
  | "logging_out";

export type AuthStateError = {
  code: AuthClientErrorCode;
  message: string;
  httpStatus: number | null;
  recoverable: boolean;
};

export type AuthState = {
  status: AuthStatus;
  customer: AuthCustomer | null;
  error: AuthStateError | null;
};

export type AuthStateControllerOptions = {
  client: StoreAuthClient;
  clearLocalCartReference(): unknown;
  writeSafeReturnPath?: (value: unknown) => string;
  clearSafeReturnPath?: () => void;
};

export type AuthStateController = {
  getState(): AuthState;
  subscribe(listener: (state: AuthState) => void): () => void;
  startLogin(provider: CustomerAuthProvider, returnPath?: unknown): Promise<string>;
  restoreSession(): Promise<AuthState>;
  logout(): Promise<AuthState>;
};

const initialState: AuthState = {
  status: "guest",
  customer: null,
  error: null,
};

export function createAuthStateController(
  options: AuthStateControllerOptions
): AuthStateController {
  let state = initialState;
  let operationSequence = 0;
  let logoutPromise: Promise<AuthState> | null = null;
  let sessionDeletionConfirmed = false;
  let lastConfirmedState: AuthState = initialState;
  const listeners = new Set<(state: AuthState) => void>();
  const storeReturnPath = options.writeSafeReturnPath ?? writeReturnPath;
  const removeReturnPath = options.clearSafeReturnPath ?? clearReturnPath;

  function emit(nextState: AuthState) {
    state = nextState;
    for (const listener of listeners) {
      listener(state);
    }
    return state;
  }

  async function startLogin(
    provider: CustomerAuthProvider,
    returnPath: unknown = "/"
  ) {
    const operation = ++operationSequence;
    storeReturnPath(returnPath);
    emit({ status: "auth_starting", customer: state.customer, error: null });

    try {
      const location = await options.client.startProviderLogin(provider);
      if (operation === operationSequence) {
        emit({ status: "provider_pending", customer: state.customer, error: null });
      }
      return location;
    } catch (error) {
      if (operation === operationSequence) {
        emit({
          status: "auth_failed",
          customer: state.customer,
          error: normalizeError(error),
        });
      }
      throw error;
    }
  }

  async function restoreSession() {
    if (logoutPromise) {
      return logoutPromise;
    }
    if (sessionDeletionConfirmed) {
      return logout();
    }

    const operation = ++operationSequence;
    emit({ status: "customer_resolving", customer: null, error: null });

    try {
      const customer = await options.client.retrieveCurrentCustomer();
      if (operation === operationSequence) {
        sessionDeletionConfirmed = false;
        lastConfirmedState = {
          status: "session_established",
          customer,
          error: null,
        };
        return emit(lastConfirmedState);
      }
      return state;
    } catch (error) {
      if (operation !== operationSequence) {
        return state;
      }
      if (error instanceof AuthClientError && error.status === 401) {
        lastConfirmedState = initialState;
        return emit(initialState);
      }
      return emit({ status: "auth_failed", customer: null, error: normalizeError(error) });
    }
  }

  async function performLogout() {
    ++operationSequence;
    const confirmedState = lastConfirmedState;
    emit({ status: "logging_out", customer: state.customer, error: null });

    if (!sessionDeletionConfirmed) {
      try {
        await options.client.logout();
      } catch (error) {
        if (!(error instanceof AuthClientError && error.status === 401)) {
          emit({ ...confirmedState, error: normalizeError(error) });
          throw error;
        }
      }
      sessionDeletionConfirmed = true;
    }

    ++operationSequence;
    emit({ status: "logging_out", customer: null, error: null });
    try {
      try {
        removeReturnPath();
      } catch {
        // Cart-reference cleanup remains mandatory after backend logout succeeds.
      }
      options.clearLocalCartReference();
    } catch (error) {
      throw error;
    }

    sessionDeletionConfirmed = false;
    lastConfirmedState = initialState;
    return emit(initialState);
  }

  function logout() {
    if (logoutPromise) {
      return logoutPromise;
    }

    const pending = performLogout();
    logoutPromise = pending;
    pending.then(
      () => {
        if (logoutPromise === pending) {
          logoutPromise = null;
        }
      },
      () => {
        if (logoutPromise === pending) {
          logoutPromise = null;
        }
      }
    );
    return pending;
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    startLogin,
    restoreSession,
    logout,
  };
}

function normalizeError(error: unknown): AuthStateError {
  if (error instanceof AuthClientError) {
    return {
      code: error.code,
      message: error.message,
      httpStatus: error.status,
      recoverable: true,
    };
  }

  return {
    code: "auth_backend_unavailable",
    message: "The customer session could not be resolved.",
    httpStatus: null,
    recoverable: true,
  };
}
