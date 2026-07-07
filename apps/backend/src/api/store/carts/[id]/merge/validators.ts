import { z } from "@medusajs/framework/zod";

export const StoreMergeCart = z.object({}).strict();

export type StoreMergeCartType = z.infer<typeof StoreMergeCart>;

export function parseStoreMergeCartBody(body: unknown): StoreMergeCartType {
  const normalized = body === undefined || body === null ? {} : body;
  const parsed = StoreMergeCart.safeParse(normalized);

  if (!parsed.success) {
    throw new StoreMergeCartValidationError();
  }

  return parsed.data;
}

export class StoreMergeCartValidationError extends Error {
  public readonly code = "cart_merge_invalid_request";
  public readonly statusCode = 400;

  constructor() {
    super("Merge request body must be empty.");
    this.name = "StoreMergeCartValidationError";
  }
}
