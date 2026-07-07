import type {
  CartDTO,
  CartLineItemDTO,
  ICartModuleService,
  MedusaContainer,
} from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
  when,
  type WorkflowData,
} from "@medusajs/framework/workflows-sdk";
import {
  acquireLockStep,
  addToCartWorkflow,
  confirmVariantInventoryWorkflow,
  refreshCartItemsWorkflow,
  releaseLockStep,
  transferCartCustomerWorkflow,
} from "@medusajs/medusa/core-flows";
import type { CartMergePlan } from "../cart-merge/plan";
import { CART_MERGE_MODULE } from "../modules/cart-merge";
import type CartMergeModuleService from "../modules/cart-merge/service";

export type CartMergeLifecycleErrorCode =
  | "cart_merge_invalid_plan"
  | "cart_merge_in_progress"
  | "cart_merge_already_completed"
  | "cart_merge_journal_conflict"
  | "cart_merge_stock_conflict"
  | "cart_merge_mutation_failed"
  | "cart_merge_compensation_failed"
  | "cart_merge_injected_failure";

export class CartMergeLifecycleError extends Error {
  constructor(
    public readonly code: CartMergeLifecycleErrorCode,
    message: string
  ) {
    super(message);
    this.name = "CartMergeLifecycleError";
  }
}

export type CartMergeLifecycleInput = {
  plan: CartMergePlan;
  inject_failure_after_source_soft_delete?: boolean;
};

export type CartMergeLifecycleResult = {
  journal_id: string;
  source_cart_id: string;
  target_cart_id: string;
  mode: CartMergePlan["mode"];
  status: "completed";
  operation_trace: string[];
};

type JournalStepResult = {
  journal_id: string;
};

type ValidationStepResult = {
  validated: true;
};

type LifecycleStepResult = {
  source_cart_id: string;
  target_cart_id: string;
  mode: CartMergePlan["mode"];
  operation_trace: string[];
};

type GraphQuery = {
  graph: (input: Record<string, unknown>) => Promise<{ data: any[] }>;
};

const INVENTORY_VARIANT_FIELDS = [
  "id",
  "manage_inventory",
  "allow_backorder",
  "inventory_items.inventory_item_id",
  "inventory_items.required_quantity",
  "inventory_items.inventory.location_levels.stocked_quantity",
  "inventory_items.inventory.location_levels.reserved_quantity",
  "inventory_items.inventory.location_levels.raw_stocked_quantity",
  "inventory_items.inventory.location_levels.raw_reserved_quantity",
  "inventory_items.inventory.location_levels.location_id",
  "inventory_items.inventory.location_levels.stock_locations.id",
  "inventory_items.inventory.location_levels.stock_locations.name",
  "inventory_items.inventory.location_levels.stock_locations.sales_channels.id",
  "inventory_items.inventory.location_levels.stock_locations.sales_channels.name",
];

const beginCartMergeJournalStep = createStep(
  "task-020-begin-cart-merge-journal",
  async (
    input: { plan: CartMergePlan },
    { container }
  ): Promise<StepResponse<JournalStepResult, { journal_id: string }>> => {
    validatePlan(input.plan);
    const service =
      container.resolve<CartMergeModuleService>(CART_MERGE_MODULE);
    const existing = (
      await service.listCartMerges({
        source_cart_id: input.plan.source_cart_id,
      })
    )[0];

    if (existing?.status === "pending") {
      throw new CartMergeLifecycleError(
        "cart_merge_in_progress",
        "A merge for this source cart is already in progress."
      );
    }
    if (existing?.status === "completed") {
      throw new CartMergeLifecycleError(
        "cart_merge_already_completed",
        "This source cart already has a completed merge."
      );
    }

    if (existing) {
      if (
        existing.customer_id !== input.plan.customer_id ||
        existing.target_cart_id !== input.plan.target_cart_id ||
        existing.mode !== input.plan.mode ||
        stableJson(existing.plan) !== stableJson(input.plan)
      ) {
        throw new CartMergeLifecycleError(
          "cart_merge_journal_conflict",
          "The failed merge journal does not match the immutable plan."
        );
      }
      if (existing.failure_code === "cart_merge_compensation_failed") {
        throw new CartMergeLifecycleError(
          "cart_merge_journal_conflict",
          "A merge with unproven compensation requires manual recovery."
        );
      }

      const updated = await service.updateCartMerges({
        id: existing.id,
        status: "pending",
        failure_code: null,
        completed_at: null,
        attempt_count: Number(existing.attempt_count) + 1,
      });
      return new StepResponse(
        { journal_id: updated.id },
        { journal_id: updated.id }
      );
    }

    const created = await service.createCartMerges({
      source_cart_id: input.plan.source_cart_id,
      target_cart_id: input.plan.target_cart_id,
      customer_id: input.plan.customer_id,
      mode: input.plan.mode,
      status: "pending",
      plan: cloneJson(input.plan),
      failure_code: null,
      attempt_count: 1,
      completed_at: null,
    });

    return new StepResponse(
      { journal_id: created.id },
      { journal_id: created.id }
    );
  },
  async (input, { container }) => {
    if (!input?.journal_id) return;
    await markJournalFailedIfPending(
      container,
      input.journal_id,
      "cart_merge_mutation_failed"
    );
  }
);

const validateCartMergeLifecycleStep = createStep(
  "task-020-validate-cart-merge-lifecycle",
  async (
    input: {
      journal_id: string;
      plan: CartMergePlan;
    },
    { container }
  ): Promise<StepResponse<ValidationStepResult>> => {
    try {
      const cartModule = container.resolve<ICartModuleService>(Modules.CART);
      const state = await loadAndValidateLifecycleState(
        cartModule,
        input.plan
      );
      if (input.plan.mode === "merge_into_existing") {
        await confirmPlanInventory(container, state.target, input.plan);
      }
      return new StepResponse({ validated: true });
    } catch (error) {
      const failureCode = classifyLifecycleFailure(error);
      await markJournalFailed(container, input.journal_id, failureCode);
      throw error;
    }
  }
);

const assertCoreCartMutationStep = createStep(
  "task-020-assert-core-cart-mutation",
  async (
    input: {
      journal_id: string;
      plan: CartMergePlan;
      validation: ValidationStepResult;
      ownership_transfer_dependency?: unknown;
      target_merge_dependency?: unknown;
    },
    { container }
  ): Promise<StepResponse<LifecycleStepResult>> => {
    try {
      const cartModule = container.resolve<ICartModuleService>(Modules.CART);
      const target = await cartModule.retrieveCart(
        input.plan.target_cart_id,
        { relations: ["items"] }
      );

      if (input.plan.mode === "ownership_transfer") {
        if (target.customer_id !== input.plan.customer_id) {
          throw new CartMergeLifecycleError(
            "cart_merge_mutation_failed",
            "The core ownership-transfer workflow did not update the cart."
          );
        }
        return new StepResponse({
          source_cart_id: input.plan.source_cart_id,
          target_cart_id: input.plan.target_cart_id,
          mode: input.plan.mode,
          operation_trace: ["source_ownership_transferred"],
        });
      }

      const targetQuantities = aggregateQuantities(target.items ?? []);
      for (const item of input.plan.items) {
        if (
          targetQuantities.get(item.variant_id) !==
          item.target_quantity_after
        ) {
          throw new CartMergeLifecycleError(
            "cart_merge_mutation_failed",
            "The core add-to-cart workflow produced an unexpected quantity."
          );
        }
      }

      return new StepResponse({
        source_cart_id: input.plan.source_cart_id,
        target_cart_id: input.plan.target_cart_id,
        mode: input.plan.mode,
        operation_trace: input.plan.items.map(
          (item) => `target_mutated:${item.variant_id}`
        ),
      });
    } catch (error) {
      const failureCode = classifyLifecycleFailure(error);
      await markJournalFailed(container, input.journal_id, failureCode);
      throw error;
    }
  }
);

const softDeleteCartMergeSourceStep = createStep(
  "task-020-soft-delete-cart-merge-source",
  async (
    input: {
      plan: CartMergePlan;
      lifecycle: LifecycleStepResult;
    },
    { container }
  ): Promise<
    StepResponse<LifecycleStepResult, { source_cart_id: string } | null>
  > => {
    if (input.plan.mode === "ownership_transfer") {
      return new StepResponse(input.lifecycle, null);
    }

    const cartModule = container.resolve<ICartModuleService>(Modules.CART);
    await cartModule.softDeleteCarts([input.plan.source_cart_id]);

    return new StepResponse(
      {
        ...input.lifecycle,
        operation_trace: [
          ...input.lifecycle.operation_trace,
          "source_soft_deleted",
        ],
      },
      { source_cart_id: input.plan.source_cart_id }
    );
  },
  async (input, { container }) => {
    if (!input?.source_cart_id) return;
    const cartModule = container.resolve<ICartModuleService>(Modules.CART);
    await cartModule.restoreCarts([input.source_cart_id]);
  }
);

const injectCartMergeFailureStep = createStep(
  "task-020-inject-cart-merge-failure",
  async (
    input: {
      journal_id: string;
      lifecycle: LifecycleStepResult;
      inject_failure?: boolean;
    },
    { container }
  ): Promise<StepResponse<LifecycleStepResult>> => {
    if (!input.inject_failure) {
      return new StepResponse(input.lifecycle);
    }

    await markJournalFailed(
      container,
      input.journal_id,
      "cart_merge_injected_failure"
    );
    throw new CartMergeLifecycleError(
      "cart_merge_injected_failure",
      "Injected failure after source soft-delete."
    );
  }
);

const completeCartMergeJournalStep = createStep(
  "task-020-complete-cart-merge-journal",
  async (
    input: {
      journal_id: string;
      lifecycle: LifecycleStepResult;
    },
    { container }
  ): Promise<
    StepResponse<CartMergeLifecycleResult, { journal_id: string }>
  > => {
    const service =
      container.resolve<CartMergeModuleService>(CART_MERGE_MODULE);
    const completed = await service.updateCartMerges({
      id: input.journal_id,
      status: "completed",
      failure_code: null,
      completed_at: new Date(),
    });

    return new StepResponse(
      {
        journal_id: completed.id,
        source_cart_id: input.lifecycle.source_cart_id,
        target_cart_id: input.lifecycle.target_cart_id,
        mode: input.lifecycle.mode,
        status: "completed",
        operation_trace: [
          ...input.lifecycle.operation_trace,
          "journal_completed",
        ],
      },
      { journal_id: completed.id }
    );
  },
  async (input, { container }) => {
    if (!input?.journal_id) return;
    const service =
      container.resolve<CartMergeModuleService>(CART_MERGE_MODULE);
    await service.updateCartMerges({
      id: input.journal_id,
      status: "pending",
      completed_at: null,
    });
  }
);

export const mergeCustomerCartWorkflow = createWorkflow(
  {
    name: "merge-customer-cart",
    idempotent: false,
  },
  (input: WorkflowData<CartMergeLifecycleInput>) => {
    const lockKeys = transform({ plan: input.plan }, ({ plan }) =>
      [...new Set([plan.source_cart_id, plan.target_cart_id])].sort()
    );

    acquireLockStep({
      key: lockKeys,
      timeout: 2,
      retryInterval: 0.1,
      ttl: 30,
    });

    const journal = beginCartMergeJournalStep({ plan: input.plan });
    const validation = validateCartMergeLifecycleStep({
      journal_id: journal.journal_id,
      plan: input.plan,
    });
    const coreInput = transform(
      { plan: input.plan, validation },
      ({ plan }) => ({
        mode: plan.mode,
        source_cart_id: plan.source_cart_id,
        target_cart_id: plan.target_cart_id,
        customer_id: plan.customer_id,
        // addToCart accepts deltas. Under the parent locks, validation proves
        // target_quantity_before is unchanged; the postcondition below then
        // proves the immutable absolute target_quantity_after.
        items: plan.items.map((item) => ({
          variant_id: item.variant_id,
          quantity: item.source_quantity,
        })),
      })
    );

    const ownershipTransfer = when(
      "task-020-ownership-transfer",
      { coreInput },
      ({ coreInput }) => coreInput.mode === "ownership_transfer"
    ).then(() =>
      transferCartCustomerWorkflow.runAsStep({
        input: {
          id: coreInput.source_cart_id,
          customer_id: coreInput.customer_id,
        },
      })
    );

    const targetMerge = when(
      "task-020-target-merge",
      { coreInput },
      ({ coreInput }) => coreInput.mode === "merge_into_existing"
    ).then(() => {
      const added = addToCartWorkflow.runAsStep({
        input: {
          cart_id: coreInput.target_cart_id,
          items: coreInput.items,
        },
      });
      const refreshInput = transform(
        { coreInput, added },
        ({ coreInput }) => ({
          cart_id: coreInput.target_cart_id,
          force_refresh: true,
        })
      );
      return refreshCartItemsWorkflow.runAsStep({
        input: refreshInput,
      });
    });

    const applied = assertCoreCartMutationStep({
      journal_id: journal.journal_id,
      plan: input.plan,
      validation,
      ownership_transfer_dependency: ownershipTransfer,
      target_merge_dependency: targetMerge,
    });
    const disposed = softDeleteCartMergeSourceStep({
      plan: input.plan,
      lifecycle: applied,
    });
    const lifecycle = injectCartMergeFailureStep({
      journal_id: journal.journal_id,
      lifecycle: disposed,
      inject_failure: input.inject_failure_after_source_soft_delete,
    });
    const completed = completeCartMergeJournalStep({
      journal_id: journal.journal_id,
      lifecycle,
    });

    releaseLockStep({ key: lockKeys });

    return new WorkflowResponse(completed);
  }
);

async function loadAndValidateLifecycleState(
  cartModule: ICartModuleService,
  plan: CartMergePlan
) {
  let source: CartDTO;
  let target: CartDTO;
  try {
    source = await cartModule.retrieveCart(plan.source_cart_id, {
      relations: ["items"],
    });
    target =
      plan.target_cart_id === plan.source_cart_id
        ? source
        : await cartModule.retrieveCart(plan.target_cart_id, {
            relations: ["items"],
          });
  } catch {
    throw invalidPlan("Source or target cart is not active.");
  }

  if (source.completed_at || target.completed_at) {
    throw invalidPlan("Completed carts cannot enter the merge lifecycle.");
  }
  if (source.customer_id && source.customer_id !== plan.customer_id) {
    throw invalidPlan("Source cart ownership changed after planning.");
  }

  if (plan.mode === "ownership_transfer") {
    if (source.id !== target.id || plan.items.length !== 0) {
      throw invalidPlan("Ownership transfer plan is inconsistent.");
    }
    return { source, target };
  }

  if (
    source.id === target.id ||
    target.customer_id !== plan.customer_id ||
    source.region_id !== target.region_id ||
    source.currency_code.toLowerCase() !==
      target.currency_code.toLowerCase() ||
    source.sales_channel_id !== target.sales_channel_id
  ) {
    throw invalidPlan("Merge carts are no longer compatible.");
  }

  const sourceQuantities = aggregateQuantities(source.items ?? []);
  const targetQuantities = aggregateQuantities(target.items ?? []);
  const targetLineIds = collectLineIdsByVariant(target.items ?? []);
  if (sourceQuantities.size !== plan.items.length) {
    throw invalidPlan("Source cart lines changed after planning.");
  }

  for (const item of plan.items) {
    if (sourceQuantities.get(item.variant_id) !== item.source_quantity) {
      throw invalidPlan("Source cart quantity changed after planning.");
    }

    const quantityBefore = targetQuantities.get(item.variant_id) ?? 0;
    const lineIds = targetLineIds.get(item.variant_id) ?? [];
    const plannedLineStillPresent = item.target_line_item_id
      ? lineIds.includes(item.target_line_item_id)
      : lineIds.length === 0;
    if (quantityBefore !== item.target_quantity_before) {
      throw invalidPlan(
        "Target cart aggregate quantity changed after planning."
      );
    }
    if (!plannedLineStillPresent) {
      throw invalidPlan("Target cart line identity changed after planning.");
    }
  }

  return { source, target };
}

async function confirmPlanInventory(
  container: MedusaContainer,
  target: CartDTO,
  plan: CartMergePlan
) {
  const query = container.resolve(
    ContainerRegistrationKeys.QUERY
  ) as unknown as GraphQuery;
  const variantIds = plan.items.map((item) => item.variant_id);
  const { data: variants } = await query.graph({
    entity: "variants",
    fields: INVENTORY_VARIANT_FIELDS,
    filters: { id: variantIds },
  });

  if (variants.length !== variantIds.length) {
    throw new CartMergeLifecycleError(
      "cart_merge_stock_conflict",
      "One or more planned variants are unavailable."
    );
  }

  try {
    await confirmVariantInventoryWorkflow(container).run({
      input: {
        sales_channel_id: target.sales_channel_id!,
        variants,
        items: plan.items.map((item) => ({
          variant_id: item.variant_id,
          quantity: item.target_quantity_after,
        })),
      },
    });
  } catch {
    throw new CartMergeLifecycleError(
      "cart_merge_stock_conflict",
      "Planned cart quantities are not sellable."
    );
  }
}

async function markJournalFailedIfPending(
  container: MedusaContainer,
  journalId: string,
  failureCode: CartMergeLifecycleErrorCode
) {
  const service =
    container.resolve<CartMergeModuleService>(CART_MERGE_MODULE);
  const journal = await service.retrieveCartMerge(journalId);
  if (journal.status === "pending") {
    await markJournalFailed(container, journalId, failureCode);
  }
}

async function markJournalFailed(
  container: MedusaContainer,
  journalId: string,
  failureCode: CartMergeLifecycleErrorCode
) {
  const service =
    container.resolve<CartMergeModuleService>(CART_MERGE_MODULE);
  await service.updateCartMerges({
    id: journalId,
    status: "failed",
    failure_code: failureCode,
    completed_at: null,
  });
}

function validatePlan(plan: CartMergePlan) {
  const required = [
    plan.source_cart_id,
    plan.target_cart_id,
    plan.customer_id,
  ];
  if (required.some((value) => typeof value !== "string" || !value.trim())) {
    throw invalidPlan("Cart merge plan IDs are required.");
  }
  if (
    plan.mode !== "ownership_transfer" &&
    plan.mode !== "merge_into_existing"
  ) {
    throw invalidPlan("Cart merge mode is invalid.");
  }
  if (
    plan.mode === "ownership_transfer" &&
    (plan.source_cart_id !== plan.target_cart_id || plan.items.length !== 0)
  ) {
    throw invalidPlan("Ownership transfer plan is inconsistent.");
  }
  if (
    plan.mode === "merge_into_existing" &&
    plan.source_cart_id === plan.target_cart_id
  ) {
    throw invalidPlan("Existing-target merge requires two carts.");
  }

  let previousVariantId = "";
  for (const item of plan.items) {
    if (
      !item.variant_id ||
      item.variant_id <= previousVariantId ||
      !Number.isSafeInteger(item.source_quantity) ||
      item.source_quantity <= 0 ||
      !Number.isSafeInteger(item.target_quantity_before) ||
      item.target_quantity_before < 0 ||
      !Number.isSafeInteger(item.target_quantity_after) ||
      item.target_quantity_after !==
        item.source_quantity + item.target_quantity_before ||
      (item.target_quantity_before === 0) !==
        (item.target_line_item_id === null)
    ) {
      throw invalidPlan("Cart merge plan item is invalid or unsorted.");
    }
    previousVariantId = item.variant_id;
  }
}

function aggregateQuantities(lines: CartLineItemDTO[]) {
  const quantities = new Map<string, number>();
  for (const line of lines) {
    if (!line.variant_id) {
      throw invalidPlan("Cart line has no Product Variant ID.");
    }
    quantities.set(
      line.variant_id,
      (quantities.get(line.variant_id) ?? 0) +
        numericValue(line.quantity)
    );
  }
  return quantities;
}

function collectLineIdsByVariant(lines: CartLineItemDTO[]) {
  const lineIds = new Map<string, string[]>();
  for (const line of lines) {
    if (!line.variant_id) {
      throw invalidPlan("Cart line has no Product Variant ID.");
    }
    const ids = lineIds.get(line.variant_id) ?? [];
    ids.push(line.id);
    ids.sort();
    lineIds.set(line.variant_id, ids);
  }
  return lineIds;
}

function classifyLifecycleFailure(
  error: unknown
): CartMergeLifecycleErrorCode {
  if (error instanceof CartMergeLifecycleError) {
    return error.code;
  }
  return "cart_merge_mutation_failed";
}

function invalidPlan(message: string) {
  return new CartMergeLifecycleError("cart_merge_invalid_plan", message);
}

function numericValue(value: unknown) {
  const primitive =
    typeof value === "object" && value !== null && "value" in value
      ? (value as { value: unknown }).value
      : value;
  const quantity = Number(primitive);
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw invalidPlan("Cart line quantity must be a positive integer.");
  }
  return quantity;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableJson(value: unknown) {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortJson(item)])
    );
  }
  return value;
}
