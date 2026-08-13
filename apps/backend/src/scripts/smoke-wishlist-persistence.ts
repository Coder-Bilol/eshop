import assert from "node:assert/strict";
import type { ExecArgs } from "@medusajs/framework/types";
import { WISHLIST_MODULE } from "../modules/wishlist";
import type WishlistModuleService from "../modules/wishlist/service";

const phase = process.env.WISHLIST_PERSISTENCE_PHASE ?? "full";
const runId = process.env.WISHLIST_PERSISTENCE_RUN_ID ??
  `task035${process.pid}${Date.now()}`;
const customerId = `cus_${runId}`;
const productId = `prod_${runId}_persisted`;
const concurrentProductId = `prod_${runId}_concurrent`;

export default async function smokeWishlistPersistence({
  container,
}: ExecArgs) {
  if (!["write", "read", "delete", "cleanup", "full"].includes(phase)) {
    throw new Error(`Unsupported wishlist persistence phase: ${phase}`);
  }

  const service = container.resolve<WishlistModuleService>(WISHLIST_MODULE);

  if (phase === "cleanup") {
    const removed = await cleanupRun(service);
    writeResult("cleanup", { removed });
    return;
  }

  if (phase === "write" || phase === "full") {
    const item = await service.createWishlistItems({
      customer_id: customerId,
      product_id: productId,
    });

    assert.equal(item.customer_id, customerId);
    assert.equal(item.product_id, productId);
    assert.ok(item.id.startsWith("witem_"));

    const concurrent = await Promise.allSettled([
      service.createWishlistItems({
        customer_id: customerId,
        product_id: concurrentProductId,
      }),
      service.createWishlistItems({
        customer_id: customerId,
        product_id: concurrentProductId,
      }),
    ]);
    assert.equal(
      concurrent.filter((result) => result.status === "fulfilled").length,
      1
    );
    assert.equal(
      concurrent.filter((result) => result.status === "rejected").length,
      1
    );

    const concurrentRows = await service.listWishlistItems({
      customer_id: customerId,
      product_id: concurrentProductId,
    });
    assert.equal(concurrentRows.length, 1);
    await service.deleteWishlistItems(concurrentRows[0].id);

    writeResult("write", {
      idPrefix: item.id.split("_")[0],
      concurrentRows: concurrentRows.length,
      duplicateOutcome: "one-created-one-unique-conflict",
    });
  }

  if (phase === "read" || phase === "full") {
    const items = await service.listWishlistItems({
      customer_id: customerId,
      product_id: productId,
    });

    assert.equal(items.length, 1);
    assert.equal(items[0].customer_id, customerId);
    assert.equal(items[0].product_id, productId);
    writeResult("read", {
      persistedAcrossExecProcesses: phase === "read",
      rows: items.length,
    });
  }

  if (phase === "delete" || phase === "full") {
    const items = await service.listWishlistItems({
      customer_id: customerId,
      product_id: productId,
    });
    assert.equal(items.length, 1);
    await service.deleteWishlistItems(items[0].id);

    const remaining = await service.listWishlistItems({
      customer_id: customerId,
      product_id: productId,
    });
    assert.equal(remaining.length, 0);
    writeResult("delete", { remaining: remaining.length });
  }
}

async function cleanupRun(service: WishlistModuleService) {
  const items = await service.listWishlistItems({ customer_id: customerId });
  if (items.length) {
    await service.deleteWishlistItems(items.map((item) => item.id));
  }
  return items.length;
}

function writeResult(currentPhase: string, details: Record<string, unknown>) {
  process.stdout.write(
    `${JSON.stringify(
      {
        suite: "wishlist-persistence",
        phase: currentPhase,
        status: "ok",
        sourceBoundary: "medusa-module-postgresql",
        productionData: false,
        ...details,
      },
      null,
      2
    )}\n`
  );
}
