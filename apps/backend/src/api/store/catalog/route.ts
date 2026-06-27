import type { MedusaRequest, MedusaResponse } from "@medusajs/framework";

const {
  CatalogValidationError,
  queryCatalog,
  queryInputFromMedusaRequest,
} = require("../../../catalog/query.ts");

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const result = await queryCatalog(queryInputFromMedusaRequest(req));
    res.json(result);
  } catch (error) {
    if (error instanceof CatalogValidationError) {
      const validationError = error as { code: string; message: string };
      res.status(400).json({
        error: {
          code: validationError.code,
          message: validationError.message,
          details: {},
        },
      });
      return;
    }

    res.status(500).json({
      error: {
        code: "catalog_query_failed",
        message: "Catalog query failed.",
        details: {},
      },
    });
  }
}
