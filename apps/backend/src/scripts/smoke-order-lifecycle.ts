import assert from "node:assert/strict";

import {
  LifecycleGuardError,
  parseServerLifecycleEvent,
  TRANSITION_TARGETS,
} from "../order-lifecycle/guards";
import {
  isCumulativeFullRefund,
  LifecycleProjectionError,
  projectOrderLifecycle,
} from "../order-lifecycle/projection";
import type { NativeLifecycleSnapshot } from "../order-lifecycle/types";

const ORDER_ID = "order_task054_synthetic";
const PAYMENT_ID = "paycol_task054_synthetic";

export default async function smokeOrderLifecycle() {
  const baseMetadata = {
    checkout_state: "pending_payment",
    checkout_cart_id: "cart_task054_preserved",
    checkout_reservation_item_ids: ["resitem_task054_preserved"],
    checkout_payment_method: "personal_request",
  };
  const pending = snapshot({
    status: "pending",
    metadata: baseMetadata,
    paymentStatus: "pending",
  });

  const paid = projectOrderLifecycle({
    snapshot: withPayment(pending, "paid"),
    event: { order_id: ORDER_ID, event: "payment_marked_paid" },
  });
  assert.equal(paid.state, "paid");
  assert.equal(paid.changed, true);
  assert.deepEqual(paid.metadata.checkout_reservation_item_ids, [
    "resitem_task054_preserved",
  ]);

  const duplicatePaid = projectOrderLifecycle({
    snapshot: withPayment({ ...pending, metadata: paid.metadata }, "paid"),
    event: {
      order_id: ORDER_ID,
      event: "payment_marked_paid",
      payment_collection_id: PAYMENT_ID,
    },
  });
  assert.equal(duplicatePaid.changed, false);

  const processing = projectOrderLifecycle({
    snapshot: {
      ...withPayment({ ...pending, metadata: paid.metadata }, "paid"),
      fulfillment: { id: "ful_task054", status: "processing", started: true },
    },
    event: { order_id: ORDER_ID, event: "fulfillment_started" },
  });
  assert.equal(processing.state, "processing");

  const completed = projectOrderLifecycle({
    snapshot: {
      ...withPayment({ ...pending, metadata: processing.metadata }, "paid"),
      status: "completed",
      fulfillment: { id: "ful_task054", status: "completed", started: true },
    },
    event: { order_id: ORDER_ID, event: "order_completed" },
  });
  assert.equal(completed.state, "completed");

  const canceled = projectOrderLifecycle({
    snapshot: {
      ...pending,
      status: "canceled",
      payment_collection: { id: PAYMENT_ID, order_id: ORDER_ID, status: "pending" },
    },
    event: { order_id: ORDER_ID, event: "order_canceled" },
  });
  assert.equal(canceled.state, "canceled");

  const expiredMetadata = {
    ...baseMetadata,
    checkout_state: "expired",
    checkout_expiry_origin: "ft-007",
    checkout_expiry_reason: "payment_timeout",
    checkout_expiry_cleanup: "pending",
  };
  const expired = projectOrderLifecycle({
    snapshot: {
      ...pending,
      status: "canceled",
      metadata: expiredMetadata,
      payment_collection: { id: PAYMENT_ID, order_id: ORDER_ID, status: "pending" },
    },
    event: { order_id: ORDER_ID, event: "order_canceled" },
  });
  assert.equal(expired.state, "canceled");
  assert.equal(expired.changed, false);
  assert.equal(expired.metadata.checkout_state, "expired");
  assert.equal(expired.metadata.checkout_expiry_cleanup, "pending");

  const legacyExpired = projectOrderLifecycle({
    snapshot: {
      ...pending,
      status: "canceled",
      metadata: {
        ...baseMetadata,
        checkout_state: "expired",
        checkout_expiry_reason: "payment_timeout",
        checkout_expiry_cleanup: "complete",
      },
      payment_collection: { id: PAYMENT_ID, order_id: ORDER_ID, status: "refunded" },
    },
    event: { order_id: ORDER_ID, event: "payment_refunded" },
  });
  assert.equal(legacyExpired.metadata.checkout_state, "expired");
  assert.equal(legacyExpired.metadata.checkout_expiry_cleanup, "complete");

  const partialRefund = projectOrderLifecycle({
    snapshot: withPayment({ ...pending, metadata: paid.metadata }, "paid", {
      raw_captured_amount: "1000",
      raw_refunded_amount: "400",
      currency_code: "rub",
    }),
    event: { order_id: ORDER_ID, event: "payment_refunded" },
  });
  assert.equal(partialRefund.state, "paid");
  assert.equal(partialRefund.changed, false);

  const cumulativeFullRefund = projectOrderLifecycle({
    snapshot: withPayment({ ...pending, metadata: paid.metadata }, "paid", {
      raw_captured_amount: "1000",
      raw_refunded_amount: "1000",
      currency_code: "rub",
    }),
    event: { order_id: ORDER_ID, event: "payment_refunded" },
  });
  assert.equal(cumulativeFullRefund.state, "refunded");
  assert.equal(
    isCumulativeFullRefund({
      currency_code: "rub",
      raw_captured_amount: 1000,
      raw_refunded_amount: 999.99,
    }),
    true
  );

  const cancellationRefund = projectOrderLifecycle({
    snapshot: {
      ...pending,
      status: "canceled",
      metadata: canceled.metadata,
      payment_collection: {
        id: PAYMENT_ID,
        order_id: ORDER_ID,
        status: "refunded",
        raw_captured_amount: 1000,
        raw_refunded_amount: 1000,
      },
    },
    event: { order_id: ORDER_ID, event: "payment_refunded" },
  });
  assert.equal(cancellationRefund.state, "canceled");
  assert.equal(cancellationRefund.changed, false);

  assert.throws(
    () =>
      projectOrderLifecycle({
        snapshot: {
          ...pending,
          metadata: canceled.metadata,
          payment_collection: {
            id: PAYMENT_ID,
            order_id: ORDER_ID,
            status: "paid",
          },
        },
        event: { order_id: ORDER_ID, event: "payment_marked_paid" },
      }),
    LifecycleProjectionError
  );
  assert.throws(
    () =>
      projectOrderLifecycle({
        snapshot: withPayment(pending, "paid", { order_id: "order_other" }),
        event: {
          order_id: ORDER_ID,
          event: "payment_marked_paid",
          payment_collection_id: PAYMENT_ID,
        },
      }),
    LifecycleProjectionError
  );
  assert.throws(
    () =>
      parseServerLifecycleEvent({
        order_id: ORDER_ID,
        event: "payment_marked_paid",
        source: "store",
      }),
    LifecycleGuardError
  );
  assert.throws(
    () =>
      parseServerLifecycleEvent({
        order_id: ORDER_ID,
        event: "unknown_event",
      }),
    LifecycleGuardError
  );

  for (const [state, targets] of Object.entries(TRANSITION_TARGETS)) {
    assert.ok(Array.isArray(targets));
    if (state === "canceled" || state === "refunded") {
      assert.equal(targets.length, 0);
    }
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "order-lifecycle-state",
        status: "ok",
        sourceBoundary: "pure-backend-order-lifecycle-projection",
        states: [
          "pending_payment",
          "paid",
          "processing",
          "completed",
          "canceled",
          "refunded",
        ],
        scenarios: {
          transitionMatrix: true,
          expiredToCanceledNormalization: true,
          ft007OriginAndLegacyCleanupPreserved: true,
          duplicateNoOp: true,
          paymentOrderDisagreementRejected: true,
          reservationMetadataPreserved: true,
          partialAndCumulativeFullRefund: true,
          cancellationOriginRefundNoOp: true,
          forgedAndUnknownEventRejected: true,
        },
        directStockMutation: false,
        providerRequest: false,
        callerSuppliedLifecycleAuthority: false,
        productionData: false,
      },
      null,
      2
    )}\n`
  );
}

function snapshot(input: {
  status: string;
  metadata: Record<string, unknown>;
  paymentStatus: string;
}): NativeLifecycleSnapshot {
  return {
    order_id: ORDER_ID,
    status: input.status,
    metadata: input.metadata,
    payment_status: input.paymentStatus,
    payment_collection: {
      id: PAYMENT_ID,
      order_id: ORDER_ID,
      status: input.paymentStatus,
    },
    fulfillment_status: "none",
  };
}

function withPayment(
  base: NativeLifecycleSnapshot,
  status: string,
  overrides: Record<string, unknown> = {}
): NativeLifecycleSnapshot {
  return {
    ...base,
    payment_status: status,
    payment_collection: {
      id: PAYMENT_ID,
      order_id: ORDER_ID,
      status,
      ...(overrides as object),
    },
  };
}

