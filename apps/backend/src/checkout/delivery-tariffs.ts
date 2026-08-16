import {
  ContainerRegistrationKeys,
  LINKS,
} from "@medusajs/framework/utils";

export type DeliveryMoney = {
  amount: number;
  currency_code: "RUB";
};

export type ShippingOptionPrice = {
  amount?: unknown;
  currency_code?: unknown;
  rules?: unknown;
};

export type ShippingOptionPriceLink = {
  shipping_option_id?: unknown;
  price_set?: {
    prices?: ShippingOptionPrice[];
  } | null;
};

type MedusaScope = {
  resolve: (key: string) => unknown;
};

type RemoteQuery = {
  (input: Record<string, unknown>): Promise<unknown>;
};

export async function loadShippingOptionPriceLinks(
  scope: MedusaScope,
  shippingOptionIds: string[]
): Promise<ShippingOptionPriceLink[]> {
  if (shippingOptionIds.length === 0) return [];

  const remoteQuery = scope.resolve(
    ContainerRegistrationKeys.REMOTE_QUERY
  ) as RemoteQuery;
  const result = await remoteQuery({
    service: LINKS.ShippingOptionPriceSet,
    variables: {
      filters: { shipping_option_id: shippingOptionIds },
    },
    fields: [
      "shipping_option_id",
      "price_set_id",
      "price_set.prices.*",
    ],
  });

  return Array.isArray(result) ? (result as ShippingOptionPriceLink[]) : [];
}

export function projectShippingOptionTariff(
  prices: ShippingOptionPrice[] | null | undefined
): DeliveryMoney | null {
  const rubPrices = (prices ?? []).filter(
    (price) =>
      typeof price.currency_code === "string" &&
      price.currency_code.toLowerCase() === "rub" &&
      !hasPriceRules(price.rules)
  );

  if (rubPrices.length !== 1) return null;

  const amount = rubPrices[0].amount;
  if (
    typeof amount !== "number" ||
    !Number.isSafeInteger(amount) ||
    amount < 0
  ) {
    return null;
  }

  return { amount, currency_code: "RUB" };
}

function hasPriceRules(rules: unknown) {
  return Array.isArray(rules) && rules.length > 0;
}
