import assert from "node:assert/strict";
import type { ExecArgs } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import {
  batchLinksWorkflow,
  createServiceZonesWorkflow,
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  deleteStockLocationsWorkflow,
} from "@medusajs/medusa/core-flows";

import {
  DELIVERY_OPTION_IDS,
  projectCheckoutDeliveryOptions,
  resolveCheckoutDeliveryOptions,
} from "../checkout/delivery-options";
import { loadShippingOptionPriceLinks } from "../checkout/delivery-tariffs";

const LOCAL_TARIFFS_RUB = [0, 500, 700] as const;

export default async function smokeCheckoutDeliveryOptions({
  container,
}: ExecArgs) {
  assert.notEqual(
    process.env.NODE_ENV,
    "production",
    "TASK-046 smoke is local-only and refuses production mode."
  );

  const fulfillment = container.resolve(Modules.FULFILLMENT) as any;
  const [shippingProfile] = await fulfillment.listShippingProfiles({
    type: "default",
  });
  const configuredProviders = await fulfillment.listFulfillmentProviders({});
  const [provider] = configuredProviders.filter(
    (candidate: { id?: unknown; is_enabled?: unknown }) =>
      candidate.id === "manual_manual" && candidate.is_enabled === true
  );
  assert.ok(shippingProfile?.id, "Default local shipping profile is missing.");
  assert.ok(
    provider?.id,
    "Enabled built-in manual fulfillment provider is missing."
  );

  const runId = `${process.pid}_${Date.now()}`;
  const createdOptionIds: string[] = [];
  let serviceZoneId: string | undefined;
  let fulfillmentSetId: string | undefined;
  let stockLocationId: string | undefined;

  try {
    const [fulfillmentSet] = await fulfillment.createFulfillmentSets([
      {
        name: `TASK-046 synthetic fulfillment set ${runId}`,
        type: "shipping",
      },
    ]);
    fulfillmentSetId = fulfillmentSet.id;

    const { result: stockLocations } = await createStockLocationsWorkflow(
      container
    ).run({
      input: {
        locations: [{ name: `TASK-046 synthetic stock location ${runId}` }],
      },
    });
    stockLocationId = stockLocations[0]?.id;
    assert.ok(stockLocationId, "Synthetic stock location was not created.");

    await batchLinksWorkflow(container).run({
      input: {
        create: [
          {
            [Modules.STOCK_LOCATION]: { stock_location_id: stockLocationId },
            [Modules.FULFILLMENT]: {
              fulfillment_provider_id: provider.id,
            },
          },
          {
            [Modules.STOCK_LOCATION]: { stock_location_id: stockLocationId },
            [Modules.FULFILLMENT]: {
              fulfillment_set_id: fulfillmentSet.id,
            },
          },
        ],
      },
    });

    const { result: serviceZones } = await createServiceZonesWorkflow(
      container
    ).run({
      input: {
        data: [
          {
            name: `TASK-046 synthetic service zone ${runId}`,
            fulfillment_set_id: fulfillmentSet.id,
          },
        ],
      },
    });
    serviceZoneId = serviceZones[0]?.id;
    assert.ok(serviceZoneId, "Synthetic service zone was not created.");

    const { result: shippingOptions } = await createShippingOptionsWorkflow(
      container
    ).run({
      input: DELIVERY_OPTION_IDS.map((id, index) => ({
        name: `TASK-046 ${id}`,
        service_zone_id: serviceZoneId as string,
        shipping_profile_id: shippingProfile.id,
        provider_id: provider.id,
        price_type: "flat" as const,
        type: {
          label: `TASK-046 ${id}`,
          description: "Synthetic local checkout delivery option.",
          code: id,
        },
        prices: [
          {
            amount: LOCAL_TARIFFS_RUB[index] * 100,
            currency_code: "rub",
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            operator: "eq" as const,
            value: "true",
          },
        ],
        metadata: {
          task_046_run_id: runId,
        },
      })),
    });
    createdOptionIds.push(...shippingOptions.map((option) => option.id));
    assert.equal(createdOptionIds.length, DELIVERY_OPTION_IDS.length);

    const projected = await resolveCheckoutDeliveryOptions(container);
    assert.deepEqual(
      projected.map((option) => option.id),
      [...DELIVERY_OPTION_IDS]
    );
    assert.deepEqual(
      projected.map((option) => option.tariff?.amount ?? null),
      LOCAL_TARIFFS_RUB.map((amount) => amount * 100)
    );
    assert.deepEqual(
      projected.map((option) => option.tariff?.currency_code ?? null),
      ["RUB", "RUB", "RUB"]
    );
    assert.deepEqual(
      projected.map((option) => option.available),
      [true, true, true]
    );

    const sourceLinks = await loadShippingOptionPriceLinks(
      container,
      createdOptionIds
    );
    const missingOptionProjection = projectCheckoutDeliveryOptions(
      shippingOptions.filter((option) => option.id !== createdOptionIds[2]) as any,
      sourceLinks.filter((link) => link.shipping_option_id !== createdOptionIds[2])
    );
    assert.deepEqual(missingOptionProjection[2], {
      id: "transport_company",
      name: "transport_company",
      tariff: null,
      available: false,
    });

    process.stdout.write(
      `${JSON.stringify(
        {
          suite: "checkout-delivery-options",
          status: "ok",
          sourceBoundary: "medusa-admin-shipping-options-pricing-link",
          synthetic: true,
          source: {
            configuredOptionCount: shippingOptions.length,
            stableIds: projected.map((option) => option.id),
            sourceType: "Admin Shipping Options type.code",
            priceSource: "Admin price_set via ShippingOptionPriceSet link",
          },
          projectedTariffsRub: projected.map((option) =>
            option.tariff ? option.tariff.amount / 100 : null
          ),
          unavailableOption: {
            id: missingOptionProjection[2].id,
            available: missingOptionProjection[2].available,
            tariff: missingOptionProjection[2].tariff,
            fallback: false,
          },
          productionData: false,
        },
        null,
        2
      )}\n`
    );
  } finally {
    if (createdOptionIds.length > 0) {
      await fulfillment.deleteShippingOptions(createdOptionIds);
    }
    if (serviceZoneId) {
      await fulfillment.deleteServiceZones(serviceZoneId);
    }
    if (fulfillmentSetId) {
      await fulfillment.deleteFulfillmentSets(fulfillmentSetId);
    }
    if (stockLocationId) {
      await deleteStockLocationsWorkflow(container).run({
        input: { ids: [stockLocationId] },
      });
    }
  }
}
