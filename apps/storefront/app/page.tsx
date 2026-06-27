import {
  CATALOG_FILTERS,
  type CatalogFilterKey,
  type CatalogResponse,
  type CatalogSearchParams,
  buildCatalogHref,
  fetchCatalog,
  formatCatalogMoney,
  formatCatalogValue,
  readSearchParam,
  selectedCatalogFilters,
} from "../lib/catalog";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams?: Promise<CatalogSearchParams>;
};

export default async function HomePage({ searchParams }: HomePageProps = {}) {
  const resolvedSearchParams = (await searchParams) || {};
  let catalog: CatalogResponse | null = null;
  let errorMessage: string | null = null;

  try {
    catalog = await fetchCatalog(resolvedSearchParams);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Catalog data is unavailable.";
  }

  return (
    <main className="catalogShell">
      <header className="catalogHeader">
        <div>
          <p className="eyebrow">Eshop catalog</p>
          <h1>Home goods</h1>
        </div>
        {catalog ? (
          <p className="catalogCount">
            {catalog.pagination.total} products from backend catalog
          </p>
        ) : null}
      </header>

      {errorMessage ? (
        <section className="catalogState" role="status">
          <h2>Catalog is not available</h2>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      {catalog ? (
        <>
          <section className="catalogLayout" aria-label="Catalog browser">
            <aside className="catalogNav" aria-label="Categories">
              <h2>Categories</h2>
              <nav className="categoryList">
                <a
                  className={
                    catalog.filters.selected.category ? "categoryLink" : "categoryLink active"
                  }
                  href={buildCatalogHref(resolvedSearchParams, {
                    category: null,
                    page: "1",
                  })}
                >
                  All home goods
                </a>
                {catalog.categories.map((category) => (
                  <a
                    key={category.handle}
                    className={
                      catalog.filters.selected.category === category.handle
                        ? "categoryLink active"
                        : "categoryLink"
                    }
                    href={buildCatalogHref(resolvedSearchParams, {
                      category: category.handle,
                      page: "1",
                    })}
                  >
                    {category.name}
                  </a>
                ))}
              </nav>
            </aside>

            <div className="catalogMain">
              <CatalogFiltersForm
                catalog={catalog}
                searchParams={resolvedSearchParams}
              />
              <SelectedState catalog={catalog} searchParams={resolvedSearchParams} />
              <ProductResults catalog={catalog} searchParams={resolvedSearchParams} />
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

function CatalogFiltersForm({
  catalog,
  searchParams,
}: {
  catalog: CatalogResponse;
  searchParams: CatalogSearchParams;
}) {
  const selected = catalog.filters.selected;

  return (
    <form className="catalogFilters" method="get" action="/">
      {selected.category ? (
        <input type="hidden" name="category" value={selected.category} />
      ) : null}
      <input type="hidden" name="page" value="1" />
      <input
        type="hidden"
        name="limit"
        value={readSearchParam(searchParams, "limit") || String(catalog.pagination.limit)}
      />

      <label className="field wideField">
        <span>Search</span>
        <input
          name="q"
          type="search"
          defaultValue={selected.q || ""}
          placeholder="Curtain rod, hook, shelf"
        />
      </label>

      <div className="priceFields">
        <label className="field">
          <span>Min price</span>
          <input
            name="price_min"
            type="number"
            min="0"
            step="1"
            defaultValue={selected.price_min ?? ""}
            placeholder={
              catalog.filters.available.price.min === null
                ? ""
                : String(catalog.filters.available.price.min)
            }
          />
        </label>
        <label className="field">
          <span>Max price</span>
          <input
            name="price_max"
            type="number"
            min="0"
            step="1"
            defaultValue={selected.price_max ?? ""}
            placeholder={
              catalog.filters.available.price.max === null
                ? ""
                : String(catalog.filters.available.price.max)
            }
          />
        </label>
      </div>

      {CATALOG_FILTERS.map((filter) => (
        <FilterSelect
          key={filter.key}
          catalog={catalog}
          filterKey={filter.key}
          label={filter.label}
        />
      ))}

      <div className="filterActions">
        <button type="submit">Apply</button>
        <a href="/">Reset</a>
      </div>
    </form>
  );
}

function FilterSelect({
  catalog,
  filterKey,
  label,
}: {
  catalog: CatalogResponse;
  filterKey: CatalogFilterKey;
  label: string;
}) {
  const values = catalog.filters.available[filterKey];
  const selected = catalog.filters.selected[filterKey] || "";

  return (
    <label className="field">
      <span>{label}</span>
      <select name={filterKey} defaultValue={selected}>
        <option value="">Any</option>
        {values.map((value) => (
          <option key={value} value={value}>
            {formatCatalogValue(value)}
          </option>
        ))}
      </select>
    </label>
  );
}

function SelectedState({
  catalog,
  searchParams,
}: {
  catalog: CatalogResponse;
  searchParams: CatalogSearchParams;
}) {
  const selected = selectedCatalogFilters(catalog);

  return (
    <section className="selectedState" aria-label="Selected filters">
      <div>
        <h2>Results</h2>
        <p>
          Page {catalog.pagination.page} of {Math.max(catalog.pagination.total_pages, 1)}
        </p>
      </div>
      {selected.length > 0 ? (
        <ul className="selectedList">
          {selected.map((item) => (
            <li key={`${item.label}:${item.value}`}>
              <span>{item.label}</span>
              {item.value}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No filters selected</p>
      )}
      <Pagination catalog={catalog} searchParams={searchParams} />
    </section>
  );
}

function ProductResults({
  catalog,
  searchParams,
}: {
  catalog: CatalogResponse;
  searchParams: CatalogSearchParams;
}) {
  if (catalog.empty) {
    return (
      <section className="catalogState" role="status">
        <h2>No products match</h2>
        <p>Change search, category, price, or filters and try again.</p>
      </section>
    );
  }

  return (
    <>
      <section className="productGrid" aria-label="Catalog products">
        {catalog.products.map((product) => (
          <article key={product.handle} className="productCard">
            <div className="productVisual" aria-hidden="true">
              <span>{product.category.name}</span>
            </div>
            <div className="productBody">
              <p className="productCategory">{product.category.name}</p>
              <h2>{product.title}</h2>
              <p>{product.description}</p>
              <p className="productPrice">
                {product.price.min === product.price.max
                  ? formatCatalogMoney(product.price.min, product.price.currency_code)
                  : `${formatCatalogMoney(
                      product.price.min,
                      product.price.currency_code
                    )} - ${formatCatalogMoney(
                      product.price.max,
                      product.price.currency_code
                    )}`}
              </p>
              <ul className="attributeList">
                {catalogProductAttributes(product).map((attribute) => (
                  <li key={attribute}>{attribute}</li>
                ))}
              </ul>
              {product.has_optional_attribute_gap ? (
                <p className="attributeGap">Some optional attributes are not set</p>
              ) : null}
            </div>
          </article>
        ))}
      </section>
      <Pagination catalog={catalog} searchParams={searchParams} compact />
    </>
  );
}

function Pagination({
  catalog,
  searchParams,
  compact = false,
}: {
  catalog: CatalogResponse;
  searchParams: CatalogSearchParams;
  compact?: boolean;
}) {
  const page = catalog.pagination.page;

  return (
    <nav
      className={compact ? "pagination compactPagination" : "pagination"}
      aria-label="Catalog pagination"
    >
      {catalog.pagination.has_prev ? (
        <a href={buildCatalogHref(searchParams, { page: String(page - 1) })}>
          Previous
        </a>
      ) : (
        <span aria-disabled="true">Previous</span>
      )}
      <strong>
        {catalog.pagination.total === 0
          ? "0 products"
          : `${catalog.products.length} of ${catalog.pagination.total}`}
      </strong>
      {catalog.pagination.has_next ? (
        <a href={buildCatalogHref(searchParams, { page: String(page + 1) })}>
          Next
        </a>
      ) : (
        <span aria-disabled="true">Next</span>
      )}
    </nav>
  );
}

function catalogProductAttributes(product: CatalogResponse["products"][number]) {
  const attributes = [
    product.attributes.color,
    product.attributes.material,
    product.attributes.size_length,
    product.attributes.mounting_method,
    product.product_type,
  ].filter((value): value is string => Boolean(value));

  return attributes.map(formatCatalogValue);
}
