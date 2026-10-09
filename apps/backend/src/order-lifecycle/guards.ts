import {
  ORDER_LIFECYCLE_EVENTS,
  ORDER_LIFECYCLE_STATES,
  type LifecycleMetadata,
  type OrderLifecycleEventKind,
  type OrderLifecycleState,
  type ServerLifecycleEvent,
} from "./types";

export const TRANSITION_TARGETS: Readonly<
  Record<OrderLifecycleState, readonly OrderLifecycleState[]>
> = {
  pending_payment: ["paid", "canceled"],
  paid: ["processing", "canceled", "refunded"],
  processing: ["completed", "canceled", "refunded"],
  completed: ["refunded"],
  canceled: [],
  refunded: [],
};

const EVENT_KEYS = new Set([
  "order_id",
  "event",
  "payment_collection_id",
  "native_event_id",
]);

export class LifecycleGuardError extends Error {
  readonly code: "order_lifecycle_invalid_event" | "order_lifecycle_conflict";

  constructor(
    message: string,
    code: "order_lifecycle_invalid_event" | "order_lifecycle_conflict" =
      "order_lifecycle_conflict"
  ) {
    super(message);
    this.name = "LifecycleGuardError";
    this.code = code;
  }
}

export function isOrderLifecycleState(
  value: unknown
): value is OrderLifecycleState {
  return (
    typeof value === "string" &&
    (ORDER_LIFECYCLE_STATES as readonly string[]).includes(value)
  );
}

export function normalizeLogicalState(
  value: unknown
): OrderLifecycleState | null {
  if (value === "expired") return "canceled";
  return isOrderLifecycleState(value) ? value : null;
}

export function isAllowedTransition(
  from: OrderLifecycleState,
  to: OrderLifecycleState
): boolean {
  return TRANSITION_TARGETS[from].includes(to);
}

export function assertAllowedTransition(
  from: OrderLifecycleState,
  to: OrderLifecycleState
): void {
  if (!isAllowedTransition(from, to)) {
    throw new LifecycleGuardError(`Transition ${from} -> ${to} is not allowed.`);
  }
}

export function parseServerLifecycleEvent(value: unknown): ServerLifecycleEvent {
  if (!isRecord(value)) {
    throw new LifecycleGuardError(
      "Lifecycle event must be a server-owned object.",
      "order_lifecycle_invalid_event"
    );
  }

  if ([...Object.keys(value)].some((key) => !EVENT_KEYS.has(key))) {
    throw new LifecycleGuardError(
      "Lifecycle event contains caller-supplied lifecycle data.",
      "order_lifecycle_invalid_event"
    );
  }
  if (typeof value.order_id !== "string" || value.order_id.trim() === "") {
    throw new LifecycleGuardError(
      "Lifecycle event order_id is required.",
      "order_lifecycle_invalid_event"
    );
  }
  if (
    typeof value.event !== "string" ||
    !(ORDER_LIFECYCLE_EVENTS as readonly string[]).includes(value.event)
  ) {
    throw new LifecycleGuardError(
      "Lifecycle event kind is not allow-listed.",
      "order_lifecycle_invalid_event"
    );
  }

  for (const key of ["payment_collection_id", "native_event_id"] as const) {
    if (value[key] !== undefined && typeof value[key] !== "string") {
      throw new LifecycleGuardError(
        `Lifecycle event ${key} is invalid.`,
        "order_lifecycle_invalid_event"
      );
    }
  }

  return {
    order_id: value.order_id,
    event: value.event as OrderLifecycleEventKind,
    ...(value.payment_collection_id === undefined
      ? {}
      : { payment_collection_id: value.payment_collection_id }),
    ...(value.native_event_id === undefined
      ? {}
      : { native_event_id: value.native_event_id }),
  };
}

export function isFt007ExpiryProjection(metadata: LifecycleMetadata): boolean {
  if (metadata.checkout_expiry_origin === "ft-007") return true;

  return (
    metadata.checkout_state === "expired" &&
    (metadata.checkout_expiry_cleanup === "pending" ||
      metadata.checkout_expiry_cleanup === "complete") &&
    (metadata.checkout_expiry_reason === undefined ||
      typeof metadata.checkout_expiry_reason === "string")
  );
}

export function cloneMetadata(
  metadata: LifecycleMetadata | null | undefined
): LifecycleMetadata {
  return { ...(metadata ?? {}) };
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

