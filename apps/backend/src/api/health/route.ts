import type { MedusaRequest, MedusaResponse } from "@medusajs/framework";

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  res.json({
    status: "ok",
    service: "eshop-backend",
  });
}
