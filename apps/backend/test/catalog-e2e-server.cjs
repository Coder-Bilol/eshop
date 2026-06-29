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
  CatalogValidationError,
  queryCatalog,
} = require(path.resolve(__dirname, "../src/catalog/query.ts"));

function createCatalogE2EServer() {
  return http.createServer(async (request, response) => {
    const requestUrl = new URL(
      request.url || "/",
      `http://${request.headers.host || "127.0.0.1"}`
    );

    if (requestUrl.pathname === "/health") {
      return json(response, 200, { status: "ok" });
    }

    if (requestUrl.pathname !== "/store/catalog") {
      return json(response, 404, {
        error: {
          code: "route_not_found",
          message: "Route not found.",
          details: {},
        },
      });
    }

    try {
      const input = Object.fromEntries(requestUrl.searchParams.entries());
      const catalog = await queryCatalog(input);
      return json(response, 200, catalog);
    } catch (error) {
      if (error instanceof CatalogValidationError) {
        return json(response, 400, {
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
          code: "catalog_query_failed",
          message: "Catalog query failed.",
          details: {},
        },
      });
    }
  });
}

function json(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

module.exports = { createCatalogE2EServer };

if (require.main === module) {
  const port = Number(process.env.PORT || "9109");
  createCatalogE2EServer().listen(port, "127.0.0.1", () => {
    console.log(`TASK-009 catalog E2E server listening on ${port}`);
  });
}
