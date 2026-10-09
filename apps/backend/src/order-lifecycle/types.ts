export const ORDER_LIFECYCLE_STATES = [
  "pending_payment",
  "paid",
  "processing",
  "completed",
  "canceled",
  "refunded",
] as const;

export type OrderLifecycleState = (typeof ORDER_LIFECYCLE_STATES)[number];

export const ORDER_LIFECYCLE_EVENTS = [
  "payment_marked_paid",
  "fulfillment_started",
  "order_completed",
  "order_canceled",
  "payment_refunded",
] as const;

export type OrderLifecycleEventKind = (typeof ORDER_LIFECYCLE_EVENTS)[number];
export type LifecycleMetadata = Record<string, unknown>;

export type MoneyLike =
  | number
  | string
  | { value?: number | string | null }
  | null
  | undefined;

export type NativeMoneyRecord = {
  amount?: MoneyLike;
  raw_amount?: MoneyLike;
};

export type NativePaymentEvidence = {
  id?: string;
  order_id?: string;
  currency_code?: string;
  status?: string;
  captured_amount?: MoneyLike;
  refunded_amount?: MoneyLike;
  raw_captured_amount?: MoneyLike;
  raw_refunded_amount?: MoneyLike;
  captures?: NativeMoneyRecord[];
  refunds?: NativeMoneyRecord[];
};

export type NativeFulfillmentEvidence = {
  id?: string;
  status?: string;
  started?: boolean;
};

export type NativeLifecycleSnapshot = {
  order_id: string;
  status?: string;
  metadata?: LifecycleMetadata | null;
  payment_collection_id?: string;
  payment_status?: string;
  payment_collection?: NativePaymentEvidence | null;
  payment_collections?: NativePaymentEvidence[];
  fulfillment_status?: string;
  fulfillment_id?: string;
  fulfillment?: NativeFulfillmentEvidence | null;
};

export type ServerLifecycleEvent = {
  order_id: string;
  event: OrderLifecycleEventKind;
  payment_collection_id?: string;
  native_event_id?: string;
};

export type LifecycleProjectionResult = {
  order_id: string;
  previous_state: OrderLifecycleState;
  state: OrderLifecycleState;
  changed: boolean;
  accepted: true;
  reason: string;
  native_order_status: string;
  payment_status: string;
  fulfillment_status: string;
  metadata: LifecycleMetadata;
};

