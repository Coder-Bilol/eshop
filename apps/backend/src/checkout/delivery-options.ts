import type { IFulfillmentModuleService } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

import {
  loadShippingOptionPriceLinks,
  projectShippingOptionTariff,
  type DeliveryMoney,
  type ShippingOptionPriceLink,
} from "./delivery-tariffs";

export const DELIVERY_OPTION_IDS = [
  "pickup",
  "city_courier",
  "transport_company",
] as const;

export type DeliveryOptionId = (typeof DELIVERY_OPTION_IDS)[number];

export type CheckoutDeliveryOption = {
  id: DeliveryOptionId;
  name: string;
  tariff: DeliveryMoney | null;
  available: boolean;
};

export type ShippingOptionSource = {
  id?: unknown;
  name?: unknown;
  price_type?: unknown;
  metadata?: unknown;
  type?: { code?: unknown } | null;
  provider?: { is_enabled?: unknown } | null;
  fulfillment_provider?: { is_enabled?: unknown } | null;
};

type MedusaScope = {
  resolve: (key: string) => unknown;
};

type DeliveryOptionContext = Record<string, unknown>;

export async function resolveCheckoutDeliveryOptions(
  scope: MedusaScope,
  context: DeliveryOptionContext = {}
): Promise<CheckoutDeliveryOption[]> {
  const sourceOptions = await loadAvailableShippingOptions(scope, context);
  const sourceIds = sourceOptions.flatMap((option) =>
    typeof option.id === "string" ? [option.id] : []
  );
  const priceLinks = await loadShippingOptionPriceLinks(scope, sourceIds);

  return projectCheckoutDeliveryOptions(sourceOptions, priceLinks);
}

export async function loadAvailableShippingOptions(
  scope: MedusaScope,
  context: DeliveryOptionContext = {}
): Promise<ShippingOptionSource[]> {
  const fulfillment = scope.resolve(
    Modules.FULFILLMENT
  ) as IFulfillmentModuleService;
  const options = await fulfillment.listShippingOptionsForContext(
    {
      context: {
        is_return: "false",
        enabled_in_store: "true",
        ...context,
      },
    },
    {
      relations: ["rules", "type", "provider"],
      take: null,
    }
  );

  return options as unknown as ShippingOptionSource[];
}

export function projectCheckoutDeliveryOptions(
  sourceOptions: ShippingOptionSource[],
  priceLinks: ShippingOptionPriceLink[]
): CheckoutDeliveryOption[] {
  const sourceByStableId = new Map<DeliveryOptionId, ShippingOptionSource[]>();
  for (const option of sourceOptions) {
    const stableId = stableDeliveryOptionId(option);
    if (!stableId) continue;
    const current = sourceByStableId.get(stableId) ?? [];
    current.push(option);
    sourceByStableId.set(stableId, current);
  }

  const priceLinkByOptionId = new Map(
    priceLinks.flatMap((link) =>
      typeof link.shipping_option_id === "string"
        ? [[link.shipping_option_id, link] as const]
        : []
    )
  );

  return DELIVERY_OPTION_IDS.map((id) => {
    const matches = sourceByStableId.get(id) ?? [];
    const option = matches.length === 1 ? matches[0] : null;
    const sourceId = option && typeof option.id === "string" ? option.id : null;
    const tariff = option
      ? projectShippingOptionTariff(
          priceLinkByOptionId.get(sourceId ?? "")?.price_set?.prices
        )
      : null;
    const provider = option?.provider ?? option?.fulfillment_provider;
    const providerEnabled = provider?.is_enabled === true;
    const available =
      option !== null &&
      option.price_type === "flat" &&
      providerEnabled &&
      tariff !== null;

    return {
      id,
      name:
        option && typeof option.name === "string" ? option.name : id,
      tariff: available ? tariff : null,
      available,
    };
  });
}

export function stableDeliveryOptionId(
  option: ShippingOptionSource
): DeliveryOptionId | null {
  const metadata =
    option.metadata && typeof option.metadata === "object"
      ? (option.metadata as Record<string, unknown>)
      : null;
  const metadataId = metadata?.checkout_delivery_id;
  if (isDeliveryOptionId(metadataId)) return metadataId;

  const typeCode = option.type?.code;
  return isDeliveryOptionId(typeCode) ? typeCode : null;
}

function isDeliveryOptionId(value: unknown): value is DeliveryOptionId {
  return (
    typeof value === "string" &&
    (DELIVERY_OPTION_IDS as readonly string[]).includes(value)
  );
}
