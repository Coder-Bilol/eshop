import assert from "node:assert/strict";
import type { ExecArgs } from "@medusajs/framework/types";
import {
  CART_MERGE_MODULE,
} from "../modules/cart-merge";
import type CartMergeModuleService from "../modules/cart-merge/service";

const phase = process.env.CART_MERGE_PERSISTENCE_PHASE ?? "full";
const sourceCartId =
  process.env.CART_MERGE_PERSISTENCE_SOURCE_CART_ID ??
  `cart_task017_${process.pid}_${Date.now()}`;

export default async function smokeCartMergePersistence({
  container,
}: ExecArgs) {
  if (!["write", "read", "full"].includes(phase)) {
    throw new Error(`Unsupported cart merge persistence phase: ${phase}`);
  }

  const service =
    container.resolve<CartMergeModuleService>(CART_MERGE_MODULE);

  if (phase === "write" || phase === "full") {
    const journal = await service.createCartMerges({
      source_cart_id: sourceCartId,
      target_cart_id: `${sourceCartId}_target`,
      customer_id: "cus_task017_synthetic",
      mode: "merge_into_existing",
      status: "pending",
      plan: {
        items: [],
      },
      failure_code: null,
      attempt_count: 1,
      completed_at: null,
    });

    assert.equal(journal.source_cart_id, sourceCartId);
    assert.ok(journal.id.startsWith("cmerge_"));

    await assert.rejects(() =>
      service.createCartMerges({
        source_cart_id: sourceCartId,
        target_cart_id: `${sourceCartId}_other_target`,
        customer_id: "cus_task017_synthetic",
        mode: "merge_into_existing",
        status: "pending",
        plan: {
          items: [],
        },
        failure_code: null,
        attempt_count: 1,
        completed_at: null,
      })
    );

    writeResult("write", {
      journalId: journal.id,
      uniqueSourceConstraint: "rejected-duplicate",
    });
  }

  if (phase === "read" || phase === "full") {
    const freshService =
      container.resolve<CartMergeModuleService>(CART_MERGE_MODULE);
    const journals = await freshService.listCartMerges({
      source_cart_id: sourceCartId,
    });

    assert.equal(journals.length, 1);
    assert.equal(journals[0].source_cart_id, sourceCartId);
    assert.equal(journals[0].customer_id, "cus_task017_synthetic");
    assert.equal(journals[0].mode, "merge_into_existing");
    assert.equal(journals[0].status, "pending");
    assert.equal(journals[0].attempt_count, 1);
    assert.deepEqual(journals[0].plan, {
      items: [],
    });

    writeResult("read", {
      journalId: journals[0].id,
      persistedAcrossExecProcesses:
        phase === "read" ? true : "single-process-smoke",
    });
  }
}

function writeResult(
  currentPhase: string,
  details: Record<string, unknown>
) {
  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "cart-merge-persistence",
        phase: currentPhase,
        status: "ok",
        sourceBoundary: "medusa-module-postgresql",
        sourceCartId,
        ...details,
      },
      null,
      2
    )}\n`
  );
}
