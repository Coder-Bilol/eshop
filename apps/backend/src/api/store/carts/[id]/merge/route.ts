import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import type { CartDTO, ICartModuleService } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import {
  CartMergePlanningError,
  buildCartMergePlan,
  loadCartMergePlanningState,
} from "../../../../../cart-merge/plan";
import { CART_MERGE_MODULE } from "../../../../../modules/cart-merge";
import type CartMergeModuleService from "../../../../../modules/cart-merge/service";
import {
  CartMergeLifecycleError,
  mergeCustomerCartWorkflow,
  type CartMergeLifecycleErrorCode,
} from "../../../../../workflows/merge-customer-cart";
import {
  StoreMergeCartValidationError,
  parseStoreMergeCartBody,
  type StoreMergeCartType,
} from "./validators";

type MergeOutcome = "transferred" | "merged" | "already_merged";

type StoreCartMergeResponse = {
  cart: CartDTO;
  merge: {
    source_cart_id: string;
    target_cart_id: string;
    outcome: MergeOutcome;
    replayed: boolean;
  };
};

type StoreCartMergeErrorCode =
  | "cart_merge_invalid_request"
  | "cart_merge_auth_required"
  | "cart_merge_source_forbidden"
  | "cart_not_found"
  | "cart_merge_incompatible"
  | "cart_merge_stock_conflict"
  | "cart_merge_in_progress"
  | "cart_merge_failed";

class StoreCartMergeError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: StoreCartMergeErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "StoreCartMergeError";
  }
}

export async function POST(
  req: AuthenticatedMedusaRequest<StoreMergeCartType> & {
    params: { id?: string };
  },
  res: MedusaResponse<StoreCartMergeResponse | { error: unknown }>
) {
  try {
    parseStoreMergeCartBody(req.validatedBody ?? req.body);

    const sourceCartId = requiredSourceCartId(req.params?.id);
    const actorCustomerId = req.auth_context?.actor_id;
    if (!actorCustomerId) {
      throw new StoreCartMergeError(
        401,
        "cart_merge_auth_required",
        "Authentication is required to merge carts."
      );
    }

    const completedReplay = await findCompletedReplay(
      req.scope,
      sourceCartId,
      actorCustomerId
    );
    if (completedReplay) {
      res.json(completedReplay);
      return;
    }

    const plan = await createPlan(req.scope, sourceCartId, actorCustomerId);
    const { result } = await mergeCustomerCartWorkflow(req.scope).run({
      input: { plan },
    });

    const cart = await retrieveCartForResponse(
      req.scope,
      result.target_cart_id
    );
    res.json({
      cart,
      merge: {
        source_cart_id: result.source_cart_id,
        target_cart_id: result.target_cart_id,
        outcome:
          result.mode === "ownership_transfer" ? "transferred" : "merged",
        replayed: false,
      },
    });
  } catch (error) {
    if (isLifecycleAlreadyCompleted(error)) {
      const actorCustomerId = req.auth_context?.actor_id;
      const replay = actorCustomerId
        ? await findCompletedReplay(req.scope, req.params.id, actorCustomerId)
        : null;
      if (replay) {
        res.json(replay);
        return;
      }
    }

    const publicError = toPublicError(error);
    res.status(publicError.statusCode).json({
      error: {
        code: publicError.code,
        message: publicError.message,
        details: publicError.details,
      },
    });
  }
}

async function findCompletedReplay(
  container: AuthenticatedMedusaRequest["scope"],
  sourceCartId: string | undefined,
  actorCustomerId: string
): Promise<StoreCartMergeResponse | null> {
  const normalizedSourceId = requiredSourceCartId(sourceCartId);
  const service =
    container.resolve<CartMergeModuleService>(CART_MERGE_MODULE);
  const journal = (
    await service.listCartMerges({
      source_cart_id: normalizedSourceId,
    })
  )[0];

  if (!journal || journal.status !== "completed") {
    return null;
  }

  if (journal.customer_id !== actorCustomerId) {
    throw new StoreCartMergeError(
      403,
      "cart_merge_source_forbidden",
      "Cart merge is not allowed."
    );
  }

  const cart = await retrieveCartForResponse(container, journal.target_cart_id);
  return {
    cart,
    merge: {
      source_cart_id: journal.source_cart_id,
      target_cart_id: journal.target_cart_id,
      outcome: "already_merged",
      replayed: true,
    },
  };
}

async function createPlan(
  container: AuthenticatedMedusaRequest["scope"],
  sourceCartId: string,
  actorCustomerId: string
) {
  try {
    const state = await loadCartMergePlanningState(
      container,
      sourceCartId,
      actorCustomerId
    );
    return buildCartMergePlan({
      source: state.source,
      candidates: state.candidates,
      actorCustomerId,
    });
  } catch (error) {
    if (error instanceof CartMergePlanningError) {
      throw mapPlanningError(error);
    }

    throw new StoreCartMergeError(
      404,
      "cart_not_found",
      "Cart was not found."
    );
  }
}

async function retrieveCartForResponse(
  container: AuthenticatedMedusaRequest["scope"],
  cartId: string
) {
  try {
    const cartModule = container.resolve<ICartModuleService>(Modules.CART);
    return await cartModule.retrieveCart(cartId, {
      relations: ["items"],
    });
  } catch {
    throw new StoreCartMergeError(
      404,
      "cart_not_found",
      "Cart was not found."
    );
  }
}

function mapPlanningError(error: CartMergePlanningError) {
  if (
    error.code === "cart_merge_source_forbidden" ||
    error.code === "cart_merge_candidate_forbidden"
  ) {
    return new StoreCartMergeError(
      403,
      "cart_merge_source_forbidden",
      "Cart merge is not allowed."
    );
  }

  return new StoreCartMergeError(
    409,
    "cart_merge_incompatible",
    "Cart cannot be merged in its current state."
  );
}

function mapLifecycleError(code: CartMergeLifecycleErrorCode) {
  if (code === "cart_merge_in_progress") {
    return new StoreCartMergeError(
      409,
      "cart_merge_in_progress",
      "Cart merge is already in progress."
    );
  }

  if (code === "cart_merge_stock_conflict") {
    return new StoreCartMergeError(
      409,
      "cart_merge_stock_conflict",
      "Cart quantities cannot be merged."
    );
  }

  if (
    code === "cart_merge_invalid_plan" ||
    code === "cart_merge_journal_conflict"
  ) {
    return new StoreCartMergeError(
      409,
      "cart_merge_incompatible",
      "Cart cannot be merged in its current state."
    );
  }

  return new StoreCartMergeError(
    500,
    "cart_merge_failed",
    "Cart merge failed."
  );
}

function toPublicError(error: unknown) {
  if (error instanceof StoreCartMergeError) {
    return error;
  }

  if (error instanceof StoreMergeCartValidationError) {
    return new StoreCartMergeError(
      error.statusCode,
      "cart_merge_invalid_request",
      error.message
    );
  }

  if (error instanceof CartMergeLifecycleError) {
    return mapLifecycleError(error.code);
  }

  const lifecycleCode = extractLifecycleCode(error);
  if (lifecycleCode) {
    return mapLifecycleError(lifecycleCode);
  }

  return new StoreCartMergeError(
    500,
    "cart_merge_failed",
    "Cart merge failed."
  );
}

function requiredSourceCartId(sourceCartId: unknown) {
  const normalized =
    typeof sourceCartId === "string" ? sourceCartId.trim() : "";
  if (!normalized) {
    throw new StoreCartMergeError(
      400,
      "cart_merge_invalid_request",
      "Source cart ID is required."
    );
  }
  return normalized;
}

function isLifecycleAlreadyCompleted(error: unknown) {
  return extractLifecycleCode(error) === "cart_merge_already_completed";
}

function extractLifecycleCode(
  error: unknown
): CartMergeLifecycleErrorCode | null {
  const visited = new Set<unknown>();
  const queue: unknown[] = [error];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }
    visited.add(current);

    if (current instanceof CartMergeLifecycleError) {
      return current.code;
    }

    if (typeof current === "object") {
      const record = current as Record<string, unknown>;
      if (typeof record.code === "string" && isLifecycleCode(record.code)) {
        return record.code;
      }
      for (const key of ["cause", "error", "innerError", "originalError"]) {
        if (record[key]) {
          queue.push(record[key]);
        }
      }
      if (Array.isArray(record.errors)) {
        queue.push(...record.errors);
      }
    }
  }

  return null;
}

function isLifecycleCode(code: string): code is CartMergeLifecycleErrorCode {
  return [
    "cart_merge_invalid_plan",
    "cart_merge_in_progress",
    "cart_merge_already_completed",
    "cart_merge_journal_conflict",
    "cart_merge_stock_conflict",
    "cart_merge_mutation_failed",
    "cart_merge_compensation_failed",
    "cart_merge_injected_failure",
  ].includes(code);
}
