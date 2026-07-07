import type {
  CartDTO,
  CartLineItemDTO,
  ICartModuleService,
  MedusaContainer,
} from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

export type CartMergePlanningErrorCode =
  | "cart_merge_invalid_cart"
  | "cart_merge_source_forbidden"
  | "cart_merge_candidate_forbidden"
  | "cart_merge_source_completed";

export class CartMergePlanningError extends Error {
  constructor(
    public readonly code: CartMergePlanningErrorCode,
    message: string
  ) {
    super(message);
    this.name = "CartMergePlanningError";
  }
}

export type CartMergePlanningLineInput = {
  id: string;
  variant_id?: string | null;
  quantity: unknown;
};

export type CartMergePlanningCartInput = {
  id: string;
  region_id?: string | null;
  customer_id?: string | null;
  sales_channel_id?: string | null;
  currency_code: string;
  completed_at?: string | Date | null;
  updated_at?: string | Date | null;
  items?: readonly CartMergePlanningLineInput[] | null;
};

export type CartMergePlanningLine = Readonly<{
  id: string;
  variant_id: string;
  quantity: number;
}>;

export type CartMergePlanningCart = Readonly<{
  id: string;
  region_id: string;
  customer_id: string | null;
  sales_channel_id: string;
  currency_code: string;
  completed_at: string | null;
  updated_at: string;
  items: readonly CartMergePlanningLine[];
}>;

export type CartMergePlanItem = Readonly<{
  variant_id: string;
  source_quantity: number;
  target_quantity_before: number;
  target_quantity_after: number;
  target_line_item_id: string | null;
}>;

export type CartMergePlan = Readonly<{
  source_cart_id: string;
  target_cart_id: string;
  customer_id: string;
  mode: "ownership_transfer" | "merge_into_existing";
  items: readonly CartMergePlanItem[];
}>;

type CartMergePlanningState = Readonly<{
  source: CartMergePlanningCart;
  candidates: readonly CartMergePlanningCart[];
}>;

export async function loadCartMergePlanningState(
  container: MedusaContainer,
  sourceCartId: string,
  actorCustomerId: string
): Promise<CartMergePlanningState> {
  const sourceId = requiredId(sourceCartId, "source cart ID");
  const customerId = requiredId(actorCustomerId, "actor customer ID");
  const cartModule = container.resolve<ICartModuleService>(Modules.CART);
  const source = await cartModule.retrieveCart(sourceId, {
    relations: ["items"],
  });
  const [, candidateCount] = await cartModule.listAndCountCarts(
    { customer_id: customerId },
    { select: ["id"], take: 1 }
  );
  const candidates =
    candidateCount > 0
      ? await cartModule.listCarts(
          { customer_id: customerId },
          {
            relations: ["items"],
            take: candidateCount,
          }
        )
      : [];

  return Object.freeze({
    source: normalizeCartForMergePlanning(source),
    candidates: Object.freeze(
      candidates.map((cart) => normalizeCartForMergePlanning(cart))
    ),
  });
}

export function buildCartMergePlan(input: {
  source: CartMergePlanningCartInput;
  candidates: readonly CartMergePlanningCartInput[];
  actorCustomerId: string;
}): CartMergePlan {
  const actorCustomerId = requiredId(
    input.actorCustomerId,
    "actor customer ID"
  );
  const source = normalizeCartForMergePlanning(input.source);
  const candidates = input.candidates.map((cart) =>
    normalizeCartForMergePlanning(cart)
  );

  if (
    source.customer_id !== null &&
    source.customer_id !== actorCustomerId
  ) {
    throw new CartMergePlanningError(
      "cart_merge_source_forbidden",
      "Source cart is not owned by the authenticated customer."
    );
  }
  if (source.completed_at !== null) {
    throw new CartMergePlanningError(
      "cart_merge_source_completed",
      "Completed source cart cannot be merged."
    );
  }

  const otherCandidates = candidates.filter(
    (candidate) => candidate.id !== source.id
  );
  const foreignCandidate = otherCandidates.find(
    (candidate) => candidate.customer_id !== actorCustomerId
  );
  if (foreignCandidate) {
    throw new CartMergePlanningError(
      "cart_merge_candidate_forbidden",
      "Destination candidates must be scoped to the authenticated customer."
    );
  }

  const target = otherCandidates
    .filter(
      (candidate) =>
        candidate.completed_at === null &&
        sameCompatibilityBoundary(source, candidate)
    )
    .sort(compareTargetPriority)[0];

  if (!target) {
    return freezePlan({
      source_cart_id: source.id,
      target_cart_id: source.id,
      customer_id: actorCustomerId,
      mode: "ownership_transfer",
      items: [],
    });
  }

  const sourceLines = aggregateLines(source.items);
  const targetLines = aggregateLines(target.items);
  const items = [...sourceLines.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([variantId, sourceAggregate]) => {
      const targetAggregate = targetLines.get(variantId);
      const targetQuantityBefore = targetAggregate?.quantity ?? 0;
      const targetQuantityAfter = safeQuantitySum(
        sourceAggregate.quantity,
        targetQuantityBefore,
        variantId
      );

      return {
        variant_id: variantId,
        source_quantity: sourceAggregate.quantity,
        target_quantity_before: targetQuantityBefore,
        target_quantity_after: targetQuantityAfter,
        target_line_item_id: targetAggregate?.lineIds[0] ?? null,
      };
    });

  return freezePlan({
    source_cart_id: source.id,
    target_cart_id: target.id,
    customer_id: actorCustomerId,
    mode: "merge_into_existing",
    items,
  });
}

export function normalizeCartForMergePlanning(
  cart: CartMergePlanningCartInput | CartDTO
): CartMergePlanningCart {
  const id = requiredId(cart.id, "cart ID");
  const regionId = requiredId(cart.region_id, `region ID for ${id}`);
  const salesChannelId = requiredId(
    cart.sales_channel_id,
    `sales channel ID for ${id}`
  );
  const currencyCode = requiredId(
    cart.currency_code,
    `currency code for ${id}`
  ).toLowerCase();
  const updatedAt = requiredDate(cart.updated_at, `updated_at for ${id}`);
  const items = (cart.items ?? []).map((line) =>
    normalizeLineForMergePlanning(line)
  );

  return Object.freeze({
    id,
    region_id: regionId,
    customer_id: optionalId(cart.customer_id),
    sales_channel_id: salesChannelId,
    currency_code: currencyCode,
    completed_at: optionalDate(cart.completed_at, `completed_at for ${id}`),
    updated_at: updatedAt,
    items: Object.freeze(items),
  });
}

function normalizeLineForMergePlanning(
  line: CartMergePlanningLineInput | CartLineItemDTO
): CartMergePlanningLine {
  const id = requiredId(line.id, "line item ID");
  const variantId = requiredId(
    line.variant_id,
    `variant ID for line item ${id}`
  );
  const quantity = integerQuantity(line.quantity, id);

  return Object.freeze({
    id,
    variant_id: variantId,
    quantity,
  });
}

function sameCompatibilityBoundary(
  source: CartMergePlanningCart,
  candidate: CartMergePlanningCart
) {
  return (
    source.region_id === candidate.region_id &&
    source.currency_code === candidate.currency_code &&
    source.sales_channel_id === candidate.sales_channel_id
  );
}

function compareTargetPriority(
  left: CartMergePlanningCart,
  right: CartMergePlanningCart
) {
  const updatedDifference =
    Date.parse(right.updated_at) - Date.parse(left.updated_at);
  return updatedDifference || left.id.localeCompare(right.id);
}

function aggregateLines(lines: readonly CartMergePlanningLine[]) {
  const aggregates = new Map<
    string,
    { quantity: number; lineIds: string[] }
  >();

  for (const line of lines) {
    const existing = aggregates.get(line.variant_id) ?? {
      quantity: 0,
      lineIds: [],
    };
    existing.quantity = safeQuantitySum(
      existing.quantity,
      line.quantity,
      line.variant_id
    );
    existing.lineIds.push(line.id);
    existing.lineIds.sort();
    aggregates.set(line.variant_id, existing);
  }

  return aggregates;
}

function freezePlan(plan: {
  source_cart_id: string;
  target_cart_id: string;
  customer_id: string;
  mode: "ownership_transfer" | "merge_into_existing";
  items: CartMergePlanItem[];
}): CartMergePlan {
  return Object.freeze({
    ...plan,
    items: Object.freeze(
      plan.items.map((item) =>
        Object.freeze({
          ...item,
        })
      )
    ),
  });
}

function requiredId(value: unknown, field: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    throw new CartMergePlanningError(
      "cart_merge_invalid_cart",
      `${field} is required for merge planning.`
    );
  }
  return normalized;
}

function optionalId(value: unknown) {
  if (value === undefined || value === null) return null;
  return requiredId(value, "customer ID");
}

function requiredDate(value: unknown, field: string) {
  const normalized = optionalDate(value, field);
  if (normalized === null) {
    throw new CartMergePlanningError(
      "cart_merge_invalid_cart",
      `${field} is required for deterministic merge planning.`
    );
  }
  return normalized;
}

function optionalDate(value: unknown, field: string) {
  if (value === undefined || value === null) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new CartMergePlanningError(
      "cart_merge_invalid_cart",
      `${field} must be a valid date.`
    );
  }
  return date.toISOString();
}

function integerQuantity(value: unknown, lineItemId: string) {
  const primitive =
    typeof value === "object" && value !== null && "value" in value
      ? (value as { value: unknown }).value
      : value;
  const quantity = Number(primitive);
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new CartMergePlanningError(
      "cart_merge_invalid_cart",
      `Line item ${lineItemId} must have a positive integer quantity.`
    );
  }
  return quantity;
}

function safeQuantitySum(left: number, right: number, variantId: string) {
  const total = left + right;
  if (!Number.isSafeInteger(total) || total <= 0) {
    throw new CartMergePlanningError(
      "cart_merge_invalid_cart",
      `Aggregated quantity for variant ${variantId} is invalid.`
    );
  }
  return total;
}
