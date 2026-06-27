const { Client } = require("@medusajs/framework/pg");

const defaultDatabaseUrl =
  "postgres://postgres:postgres@127.0.0.1:5432/eshop";
const catalogCategoriesTable = "eshop_local_catalog_categories";
const catalogProductsTable = "eshop_local_catalog_products";
const catalogVariantsTable = "eshop_local_catalog_variants";

type QueryRow = Record<string, any>;

type QueryableClient = {
  query: (
    statement: string,
    params?: unknown[]
  ) => Promise<{ rows: QueryRow[]; rowCount?: number | null }>;
};

type CatalogQueryInput = Record<string, unknown>;

type NormalizedCatalogQuery = {
  category: string | null;
  q: string | null;
  price_min: number | null;
  price_max: number | null;
  color: string | null;
  material: string | null;
  size_length: string | null;
  product_type: string | null;
  mounting_method: string | null;
  page: number;
  limit: number;
};

class CatalogValidationError extends Error {
  statusCode = 400;
  code = "catalog_invalid_query";

  constructor(message: string) {
    super(message);
    this.name = "CatalogValidationError";
  }
}

function queryInputFromMedusaRequest(req: { query?: unknown; url?: string }) {
  if (req.query && typeof req.query === "object") {
    return req.query as CatalogQueryInput;
  }

  const url = new URL(req.url || "/store/catalog", "http://localhost");
  const query: CatalogQueryInput = {};
  for (const [key, value] of url.searchParams.entries()) {
    query[key] = value;
  }
  return query;
}

async function queryCatalog(
  input: CatalogQueryInput = {},
  options: { connectionString?: string } = {}
) {
  const connectionString =
    options.connectionString || process.env.DATABASE_URL || defaultDatabaseUrl;
  const client = new Client({ connectionString });

  await client.connect();
  try {
    return await queryCatalogWithClient(client, input);
  } finally {
    await client.end();
  }
}

async function queryCatalogWithClient(
  client: QueryableClient,
  input: CatalogQueryInput = {}
) {
  const query = normalizeCatalogQuery(input);
  const categories = await loadCategories(client);
  const availableFilters = await loadAvailableFilters(client);
  const where = buildProductWhereClause(query);

  const countResult = await client.query(
    `
      select count(*)::int as total
      from ${catalogProductsTable} p
      join ${catalogCategoriesTable} c on c.id = p.category_id
      where ${where.sql}
    `,
    where.params
  );
  const total = Number(countResult.rows[0]?.total || 0);
  const offset = (query.page - 1) * query.limit;
  const productsResult = await client.query(
    `
      select
        p.handle,
        p.title,
        p.description,
        p.product_type,
        p.color,
        p.material,
        p.size_length,
        p.mounting_method,
        p.currency_code,
        p.has_optional_attribute_gap,
        c.handle as category_handle,
        c.name as category_name,
        min(v.price_amount)::int as min_price,
        max(v.price_amount)::int as max_price,
        json_agg(
          json_build_object(
            'sku', v.sku,
            'title', v.title,
            'price', json_build_object(
              'amount', v.price_amount,
              'currency_code', v.currency_code
            ),
            'attributes', json_build_object(
              'color', v.color,
              'material', v.material,
              'size_length', v.size_length,
              'mounting_method', v.mounting_method
            )
          )
          order by v.title asc
        ) as variants
      from ${catalogProductsTable} p
      join ${catalogCategoriesTable} c on c.id = p.category_id
      join ${catalogVariantsTable} v on v.product_id = p.id and v.is_active = true
      where ${where.sql}
      group by
        p.id,
        c.handle,
        c.name
      order by p.title asc
      limit $${where.params.length + 1}
      offset $${where.params.length + 2}
    `,
    [...where.params, query.limit, offset]
  );

  const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

  return {
    products: productsResult.rows.map(mapProductRow),
    categories,
    filters: {
      selected: {
        category: query.category,
        q: query.q,
        price_min: query.price_min,
        price_max: query.price_max,
        color: query.color,
        material: query.material,
        size_length: query.size_length,
        product_type: query.product_type,
        mounting_method: query.mounting_method,
      },
      available: availableFilters,
    },
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      total_pages: totalPages,
      has_next: query.page < totalPages,
      has_prev: query.page > 1 && totalPages > 0,
    },
    empty: total === 0,
  };
}

function normalizeCatalogQuery(input: CatalogQueryInput): NormalizedCatalogQuery {
  const priceMin = parseOptionalNonNegativeInt(input.price_min, "price_min");
  const priceMax = parseOptionalNonNegativeInt(input.price_max, "price_max");
  if (priceMin !== null && priceMax !== null && priceMin > priceMax) {
    throw new CatalogValidationError("price_min must be less than or equal to price_max.");
  }

  return {
    category: readOptionalString(input.category),
    q: readOptionalString(input.q),
    price_min: priceMin,
    price_max: priceMax,
    color: readOptionalString(input.color),
    material: readOptionalString(input.material),
    size_length: readOptionalString(input.size_length),
    product_type: readOptionalString(input.product_type),
    mounting_method: readOptionalString(input.mounting_method),
    page: parsePositiveInt(input.page, "page", 1, 10_000),
    limit: parsePositiveInt(input.limit, "limit", 12, 100),
  };
}

function buildProductWhereClause(query: NormalizedCatalogQuery) {
  const clauses = [
    "c.is_active = true",
    `exists (
      select 1
      from ${catalogVariantsTable} active_v
      where active_v.product_id = p.id and active_v.is_active = true
    )`,
  ];
  const params: unknown[] = [];
  const variantClauses = ["filter_v.product_id = p.id", "filter_v.is_active = true"];

  const addParam = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (query.category) {
    const placeholder = addParam(query.category);
    clauses.push(`(c.handle = ${placeholder} or c.id = ${placeholder})`);
  }

  if (query.q) {
    const placeholder = addParam(`%${query.q}%`);
    clauses.push(`(
      lower(p.title) like lower(${placeholder})
      or lower(p.description) like lower(${placeholder})
      or lower(p.handle) like lower(${placeholder})
      or lower(c.name) like lower(${placeholder})
      or exists (
        select 1
        from ${catalogVariantsTable} search_v
        where search_v.product_id = p.id
          and search_v.is_active = true
          and lower(search_v.sku) like lower(${placeholder})
      )
    )`);
  }

  for (const column of ["color", "material", "size_length", "mounting_method"] as const) {
    if (query[column]) {
      variantClauses.push(`filter_v.${column} = ${addParam(query[column])}`);
    }
  }

  if (query.price_min !== null) {
    variantClauses.push(`filter_v.price_amount >= ${addParam(query.price_min)}`);
  }

  if (query.price_max !== null) {
    variantClauses.push(`filter_v.price_amount <= ${addParam(query.price_max)}`);
  }

  if (variantClauses.length > 2) {
    clauses.push(`exists (
      select 1
      from ${catalogVariantsTable} filter_v
      where ${variantClauses.join(" and ")}
    )`);
  }

  if (query.product_type) {
    clauses.push(`p.product_type = ${addParam(query.product_type)}`);
  }

  return {
    sql: clauses.join(" and "),
    params,
  };
}

async function loadCategories(client: QueryableClient) {
  const result = await client.query(`
    select child.handle, child.name, parent.handle as parent_handle
    from ${catalogCategoriesTable} child
    left join ${catalogCategoriesTable} parent on parent.id = child.parent_id
    where child.is_active = true
    order by child.name asc
  `);

  return result.rows.map((row) => ({
    handle: String(row.handle),
    name: String(row.name),
    parent_handle: row.parent_handle === null ? null : String(row.parent_handle),
  }));
}

async function loadAvailableFilters(client: QueryableClient) {
  const priceRange = await client.query(`
    select min(v.price_amount)::int as min, max(v.price_amount)::int as max
    from ${catalogVariantsTable} v
    join ${catalogProductsTable} p on p.id = v.product_id
    join ${catalogCategoriesTable} c on c.id = p.category_id
    where v.is_active = true and c.is_active = true
  `);
  const productTypes = await listDistinctProductValues(client, "product_type");
  const colors = await listDistinctVariantValues(client, "color");
  const materials = await listDistinctVariantValues(client, "material");
  const sizeLengths = await listDistinctVariantValues(client, "size_length");
  const mountingMethods = await listDistinctVariantValues(client, "mounting_method");

  return {
    category: await loadCategories(client),
    price: {
      min: nullableNumber(priceRange.rows[0]?.min),
      max: nullableNumber(priceRange.rows[0]?.max),
    },
    color: colors,
    material: materials,
    size_length: sizeLengths,
    product_type: productTypes,
    mounting_method: mountingMethods,
  };
}

async function listDistinctProductValues(client: QueryableClient, column: "product_type") {
  const result = await client.query(`
    select distinct p.${column} as value
    from ${catalogProductsTable} p
    join ${catalogCategoriesTable} c on c.id = p.category_id
    where c.is_active = true and p.${column} is not null and p.${column} <> ''
    order by value asc
  `);
  return result.rows.map((row) => String(row.value));
}

async function listDistinctVariantValues(
  client: QueryableClient,
  column: "color" | "material" | "size_length" | "mounting_method"
) {
  const result = await client.query(`
    select distinct v.${column} as value
    from ${catalogVariantsTable} v
    join ${catalogProductsTable} p on p.id = v.product_id
    join ${catalogCategoriesTable} c on c.id = p.category_id
    where v.is_active = true
      and c.is_active = true
      and v.${column} is not null
      and v.${column} <> ''
    order by value asc
  `);
  return result.rows.map((row) => String(row.value));
}

function mapProductRow(row: QueryRow) {
  return {
    handle: String(row.handle),
    title: String(row.title),
    description: String(row.description),
    category: {
      handle: String(row.category_handle),
      name: String(row.category_name),
    },
    product_type: String(row.product_type),
    price: {
      min: Number(row.min_price),
      max: Number(row.max_price),
      currency_code: String(row.currency_code),
    },
    attributes: {
      color: nullableString(row.color),
      material: nullableString(row.material),
      size_length: nullableString(row.size_length),
      mounting_method: nullableString(row.mounting_method),
    },
    has_optional_attribute_gap: Boolean(row.has_optional_attribute_gap),
    variants: normalizeVariants(row.variants),
  };
}

function normalizeVariants(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return JSON.parse(value);
  return [];
}

function readOptionalString(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === null) return null;
  const text = String(raw).trim();
  return text.length > 0 ? text : null;
}

function parseOptionalNonNegativeInt(value: unknown, name: string) {
  const text = readOptionalString(value);
  if (text === null) return null;
  const parsed = Number(text);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new CatalogValidationError(`${name} must be a non-negative integer.`);
  }
  return parsed;
}

function parsePositiveInt(
  value: unknown,
  name: string,
  defaultValue: number,
  max: number
) {
  const text = readOptionalString(value);
  if (text === null) return defaultValue;
  const parsed = Number(text);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new CatalogValidationError(`${name} must be a positive integer.`);
  }
  return Math.min(parsed, max);
}

function nullableString(value: unknown) {
  return value === null || value === undefined ? null : String(value);
}

function nullableNumber(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}

module.exports = {
  CatalogValidationError,
  queryCatalog,
  queryCatalogWithClient,
  queryInputFromMedusaRequest,
};
