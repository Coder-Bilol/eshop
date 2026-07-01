import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework";

const {
  ProductDetailNotFoundError,
  ProductDetailValidationError,
  productDetailInputFromMedusaRequest,
  queryProductDetail,
} = require("../../../../catalog/product-detail");

export async function GET(req: MedusaStoreRequest, res: MedusaResponse) {
  try {
    const result = await queryProductDetail(
      req.scope,
      productDetailInputFromMedusaRequest(req),
      req.publishable_key_context.sales_channel_ids
    );
    res.json(result);
  } catch (error) {
    if (
      error instanceof ProductDetailValidationError ||
      error instanceof ProductDetailNotFoundError
    ) {
      const contractError = error as {
        code: string;
        message: string;
        statusCode: number;
      };
      res.status(contractError.statusCode).json({
        error: {
          code: contractError.code,
          message: contractError.message,
          details: {},
        },
      });
      return;
    }

    res.status(500).json({
      error: {
        code: "product_detail_query_failed",
        message: "Product detail query failed.",
        details: {},
      },
    });
  }
}
