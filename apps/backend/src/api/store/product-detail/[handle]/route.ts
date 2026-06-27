import type { MedusaRequest, MedusaResponse } from "@medusajs/framework";

const {
  ProductDetailNotFoundError,
  ProductDetailValidationError,
  productDetailInputFromMedusaRequest,
  queryProductDetail,
} = require("../../../../catalog/product-detail.ts");

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const result = await queryProductDetail(productDetailInputFromMedusaRequest(req));
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
