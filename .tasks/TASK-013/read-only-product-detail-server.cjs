const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const {
  ProductDetailNotFoundError,
  ProductDetailValidationError,
  queryProductDetail,
} = require(path.resolve(
  __dirname,
  "../../apps/backend/src/catalog/product-detail.ts"
));

const server = http.createServer(async (request, response) => {
  if (request.url === "/health") {
    return json(response, 200, { status: "ok" });
  }

  const match = request.url?.match(/^\/store\/product-detail\/([^/?]+)$/);
  if (!match) {
    return json(response, 404, {
      error: {
        code: "route_not_found",
        message: "Route not found.",
        details: {},
      },
    });
  }

  try {
    const product = await queryProductDetail({
      handle: decodeURIComponent(match[1]),
    });
    return json(response, 200, product);
  } catch (error) {
    if (
      error instanceof ProductDetailNotFoundError ||
      error instanceof ProductDetailValidationError
    ) {
      return json(response, error.statusCode, {
        error: {
          code: error.code,
          message: error.message,
          details: {},
        },
      });
    }

    console.error(error);
    return json(response, 500, {
      error: {
        code: "product_detail_query_failed",
        message: "Product detail query failed.",
        details: {},
      },
    });
  }
});

server.listen(9000, "127.0.0.1", () => {
  console.log("TASK-013 read-only product detail server listening on 9000");
});

function json(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}
