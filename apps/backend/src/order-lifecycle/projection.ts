import {
  assertAllowedTransition,
  cloneMetadata,
  isFt007ExpiryProjection,
  isOrderLifecycleState,
  parseServerLifecycleEvent,
} from "./guards";
import type {
  LifecycleMetadata,
  LifecycleProjectionResult,
  MoneyLike,
  NativeLifecycleSnapshot,
  NativePaymentEvidence,
  OrderLifecycleState,
  ServerLifecycleEvent,
} from "./types";

const PAID_PAYMENT_STATUSES = new Set([
  "paid",
  "captured",
  "succeeded",
  "successful",
]);
const FULFILLMENT_STARTED_STATUSES = new Set([
  "processing",
  "shipped",
  "delivered",
  "fulfilled",
  "completed",
]);
const CURRENCY_PRECISION: Record<string, number> = {
  bif: 3,
  bhd: 3,
  jod: 3,
  kwd: 3,
  omr: 3,
  tnd: 3,
  clp: 0,
  djf: 0,
  gnf: 0,
  isk: 0,
  jpy: 0,
  kmf: 0,
  krw: 0,
  pyg: 0,
  rwf: 0,
  ugx: 0,
  vnd: 0,
  vuv: 0,
  xaf: 0,
  xof: 0,
  xpf: 0,
};

export class LifecycleProjectionError extends Error {
  readonly code = "order_lifecycle_conflict" as const;

  constructor(message: string) {
    super(message);
    this.name = "LifecycleProjectionError";
  }
}

export function projectOrderLifecycle(input: {
  snapshot: NativeLifecycleSnapshot;
  event: unknown;
}): LifecycleProjectionResult {
  const event = parseServerLifecycleEvent(input.event);
  const snapshot = assertSnapshot(input.snapshot);
  if (event.order_id !== snapshot.order_id) {
    throw new LifecycleProjectionError(
      "Lifecycle event does not match the authoritative order."
    );
  }

  const metadata = cloneMetadata(snapshot.metadata);
  const previousState = currentLogicalState(snapshot, metadata);
  const nativeOrderStatus = nativeStatus(snapshot);
  assertPaymentBindingIfNeeded(snapshot, event);

  if (event.event === "payment_marked_paid") {
    requirePaymentCollection(snapshot, event);
    if (previousState === "paid") {
      return result({
        snapshot,
        previousState,
        state: previousState,
        changed: false,
        reason: "payment_already_projected",
        metadata,
      });
    }
    if (
      previousState !== "pending_payment" ||
      nativeOrderStatus === "canceled" ||
      nativeOrderStatus === "completed" ||
      !isPaidPayment(snapshot)
    ) {
      throw new LifecycleProjectionError(
        "Native payment evidence cannot produce the requested paid transition."
      );
    }
    return transitionResult({
      snapshot,
      previousState,
      state: "paid",
      reason: "native_admin_payment_marked_paid",
      metadata,
    });
  }

  if (event.event === "fulfillment_started") {
    if (previousState === "processing") {
      return result({
        snapshot,
        previousState,
        state: previousState,
        changed: false,
        reason: "fulfillment_already_projected",
        metadata,
      });
    }
    if (
      previousState !== "paid" ||
      nativeOrderStatus === "canceled" ||
      !isPaidPayment(snapshot) ||
      !hasStartedFulfillment(snapshot)
    ) {
      throw new LifecycleProjectionError(
        "Native fulfillment evidence cannot produce the requested processing transition."
      );
    }
    return transitionResult({
      snapshot,
      previousState,
      state: "processing",
      reason: "native_admin_fulfillment_started",
      metadata,
    });
  }

  if (event.event === "order_completed") {
    if (previousState === "completed") {
      return result({
        snapshot,
        previousState,
        state: previousState,
        changed: false,
        reason: "completion_already_projected",
        metadata,
      });
    }
    if (
      previousState !== "processing" ||
      nativeOrderStatus !== "completed" ||
      !isPaidPayment(snapshot)
    ) {
      throw new LifecycleProjectionError(
        "Native completion evidence cannot produce the requested completed transition."
      );
    }
    return transitionResult({
      snapshot,
      previousState,
      state: "completed",
      reason: "native_admin_order_completed",
      metadata,
    });
  }

  if (event.event === "order_canceled") {
    if (nativeOrderStatus !== "canceled") {
      throw new LifecycleProjectionError(
        "Cancellation is not committed in the authoritative native order."
      );
    }
    if (isFt007ExpiryProjection(metadata)) {
      return result({
        snapshot,
        previousState,
        state: "canceled",
        changed: false,
        reason: "ft007_expiry_projection_preserved",
        metadata,
      });
    }
    if (previousState === "canceled") {
      return result({
        snapshot,
        previousState,
        state: previousState,
        changed: false,
        reason: "cancellation_already_projected",
        metadata,
      });
    }
    if (
      previousState !== "pending_payment" &&
      previousState !== "paid" &&
      previousState !== "processing"
    ) {
      throw new LifecycleProjectionError(
        "Native cancellation cannot overwrite a terminal lifecycle state."
      );
    }
    return transitionResult({
      snapshot,
      previousState,
      state: "canceled",
      reason: "native_admin_order_canceled",
      metadata,
    });
  }

  if (previousState === "refunded") {
    return result({
      snapshot,
      previousState,
      state: previousState,
      changed: false,
      reason: "refund_already_projected",
      metadata,
    });
  }
  if (nativeOrderStatus === "canceled") {
    if (isFt007ExpiryProjection(metadata)) {
      return result({
        snapshot,
        previousState,
        state: "canceled",
        changed: false,
        reason: "ft007_cancellation_refund_preserved",
        metadata,
      });
    }
    if (previousState !== "canceled") {
      throw new LifecycleProjectionError(
        "Cancellation-origin refund cannot project a canceled native order from another logical state."
      );
    }
    return result({
      snapshot,
      previousState,
      state: previousState,
      changed: false,
      reason: "cancellation_origin_refund_noop",
      metadata,
    });
  }
  if (
    previousState !== "paid" &&
    previousState !== "processing" &&
    previousState !== "completed"
  ) {
    throw new LifecycleProjectionError(
      "Refund evidence cannot transition the current lifecycle state."
    );
  }
  if (!isCumulativeFullRefundForPayments(paymentCollections(snapshot))) {
    return result({
      snapshot,
      previousState,
      state: previousState,
      changed: false,
      reason: "partial_refund_preserves_lifecycle_state",
      metadata,
    });
  }
  return transitionResult({
    snapshot,
    previousState,
    state: "refunded",
    reason: "cumulative_full_refund",
    metadata,
  });
}

export function isCumulativeFullRefund(
  payment: NativePaymentEvidence | NativePaymentEvidence[]
): boolean {
  return isCumulativeFullRefundForPayments(
    Array.isArray(payment) ? payment : [payment]
  );
}

function isCumulativeFullRefundForPayments(
  payments: NativePaymentEvidence[]
): boolean {
  if (payments.length === 0) return false;

  let captured = 0;
  let refunded = 0;
  let currency: string | undefined;
  for (const record of payments) {
    if (record.currency_code !== undefined) {
      const normalizedCurrency = record.currency_code.toLowerCase();
      if (currency && currency !== normalizedCurrency) return false;
      currency = normalizedCurrency;
    }
    captured += totalCaptured(record);
    refunded += totalRefunded(record);
  }

  if (captured <= 0 || refunded < 0) return false;
  const epsilon = 10 ** -(CURRENCY_PRECISION[currency ?? ""] ?? 2);
  return captured - refunded <= epsilon;
}

function assertSnapshot(value: NativeLifecycleSnapshot): NativeLifecycleSnapshot {
  if (
    !value ||
    typeof value !== "object" ||
    typeof value.order_id !== "string" ||
    value.order_id.trim() === ""
  ) {
    throw new LifecycleProjectionError("Authoritative order snapshot is invalid.");
  }
  return value;
}

function currentLogicalState(
  snapshot: NativeLifecycleSnapshot,
  metadata: LifecycleMetadata
): OrderLifecycleState {
  const metadataState = metadata.checkout_state;
  if (metadataState === "expired") return "canceled";
  if (isOrderLifecycleState(metadataState)) return metadataState;

  const status = nativeStatus(snapshot);
  if (status === "canceled") return "canceled";
  if (status === "completed" && isPaidPayment(snapshot)) return "completed";
  if (hasStartedFulfillment(snapshot) && isPaidPayment(snapshot)) {
    return "processing";
  }
  if (isPaidPayment(snapshot)) return "paid";
  if (status === "pending") return "pending_payment";
  throw new LifecycleProjectionError(
    "Authoritative native state has no deterministic lifecycle projection."
  );
}

function nativeStatus(snapshot: NativeLifecycleSnapshot): string {
  return typeof snapshot.status === "string" && snapshot.status
    ? snapshot.status
    : "unknown";
}

function paymentStatusFor(snapshot: NativeLifecycleSnapshot): string {
  if (typeof snapshot.payment_status === "string" && snapshot.payment_status) {
    return snapshot.payment_status;
  }
  const statuses = paymentCollections(snapshot)
    .map((payment) => payment.status)
    .filter((status): status is string => typeof status === "string");
  return statuses[0] ?? "unavailable";
}

function fulfillmentStatusFor(snapshot: NativeLifecycleSnapshot): string {
  if (
    typeof snapshot.fulfillment_status === "string" &&
    snapshot.fulfillment_status
  ) {
    return snapshot.fulfillment_status;
  }
  if (snapshot.fulfillment?.status) return snapshot.fulfillment.status;
  return snapshot.fulfillment?.started || snapshot.fulfillment_id
    ? "processing"
    : "none";
}

function paymentCollections(
  snapshot: NativeLifecycleSnapshot
): NativePaymentEvidence[] {
  if (Array.isArray(snapshot.payment_collections)) {
    return snapshot.payment_collections;
  }
  return snapshot.payment_collection ? [snapshot.payment_collection] : [];
}

function requirePaymentCollection(
  snapshot: NativeLifecycleSnapshot,
  event: ServerLifecycleEvent
): NativePaymentEvidence[] {
  const payments = paymentCollections(snapshot);
  if (payments.length === 0) {
    throw new LifecycleProjectionError(
      "A lifecycle payment event requires an authoritative payment collection."
    );
  }
  if (
    event.payment_collection_id &&
    !payments.some((payment) => payment.id === event.payment_collection_id)
  ) {
    throw new LifecycleProjectionError(
      "Payment collection does not belong to the authoritative order."
    );
  }
  return payments;
}

function assertPaymentBindingIfNeeded(
  snapshot: NativeLifecycleSnapshot,
  event: ServerLifecycleEvent
) {
  if (
    event.event !== "payment_marked_paid" &&
    event.event !== "payment_refunded"
  ) {
    return;
  }
  const payments = requirePaymentCollection(snapshot, event);
  if (
    payments.some(
      (payment) => payment.order_id && payment.order_id !== snapshot.order_id
    )
  ) {
    throw new LifecycleProjectionError(
      "Payment collection is bound to a different order."
    );
  }
}

function isPaidPayment(snapshot: NativeLifecycleSnapshot): boolean {
  const statuses = paymentCollections(snapshot)
    .map((payment) => payment.status)
    .filter((status): status is string => typeof status === "string")
    .map((status) => status.toLowerCase());
  return (
    (typeof snapshot.payment_status === "string" &&
      PAID_PAYMENT_STATUSES.has(snapshot.payment_status.toLowerCase())) ||
    statuses.some((status) => PAID_PAYMENT_STATUSES.has(status))
  );
}

function hasStartedFulfillment(snapshot: NativeLifecycleSnapshot): boolean {
  const status = fulfillmentStatusFor(snapshot).toLowerCase();
  return (
    snapshot.fulfillment?.started === true ||
    Boolean(snapshot.fulfillment_id) ||
    FULFILLMENT_STARTED_STATUSES.has(status)
  );
}

function totalCaptured(payment: NativePaymentEvidence): number {
  return totalAmount(
    payment.raw_captured_amount ?? payment.captured_amount,
    payment.captures
  );
}

function totalRefunded(payment: NativePaymentEvidence): number {
  return totalAmount(
    payment.raw_refunded_amount ?? payment.refunded_amount,
    payment.refunds
  );
}

function totalAmount(
  direct: MoneyLike,
  records: NativePaymentEvidence["captures"] | NativePaymentEvidence["refunds"]
): number {
  const directValue = moneyValue(direct);
  if (directValue !== null) return directValue;
  return (records ?? []).reduce((sum, record) => {
    return sum + (moneyValue(record.raw_amount ?? record.amount) ?? 0);
  }, 0);
}

function moneyValue(value: MoneyLike): number | null {
  const candidate =
    typeof value === "object" && value !== null ? value.value : value;
  if (candidate === null || candidate === undefined || candidate === "") {
    return null;
  }
  const number = Number(candidate);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function transitionResult(input: {
  snapshot: NativeLifecycleSnapshot;
  previousState: OrderLifecycleState;
  state: OrderLifecycleState;
  reason: string;
  metadata: LifecycleMetadata;
}): LifecycleProjectionResult {
  assertAllowedTransition(input.previousState, input.state);
  return result({ ...input, changed: true });
}

function result(input: {
  snapshot: NativeLifecycleSnapshot;
  previousState: OrderLifecycleState;
  state: OrderLifecycleState;
  changed: boolean;
  reason: string;
  metadata: LifecycleMetadata;
}): LifecycleProjectionResult {
  const metadata = cloneMetadata(input.metadata);
  if (input.changed) metadata.checkout_state = input.state;

  return {
    order_id: input.snapshot.order_id,
    previous_state: input.previousState,
    state: input.state,
    changed: input.changed,
    accepted: true,
    reason: input.reason,
    native_order_status: nativeStatus(input.snapshot),
    payment_status: paymentStatusFor(input.snapshot),
    fulfillment_status: fulfillmentStatusFor(input.snapshot),
    metadata,
  };
}
