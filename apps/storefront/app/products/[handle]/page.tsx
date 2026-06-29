import { ProductDetailSelector } from "../../../components/product-detail-selector";
import {
  ProductDetailFetchError,
  fetchProductDetail,
  type ProductDetail,
} from "../../../lib/product-detail";

export const dynamic = "force-dynamic";

type ProductDetailPageProps = {
  params: Promise<{
    handle: string;
  }>;
};

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { handle } = await params;

  try {
    const product = await fetchProductDetail(handle);
    return <ProductDetailView product={product} />;
  } catch (error) {
    return <ProductDetailErrorState error={error} />;
  }
}

function ProductDetailView({ product }: { product: ProductDetail }) {
  const media = product.media[0] || null;

  return (
    <main className="productDetailShell">
      <nav className="detailBreadcrumb" aria-label="Breadcrumb">
        <a href="/">Catalog</a>
        <span aria-hidden="true">/</span>
        <span>{product.category.name}</span>
      </nav>

      <section className="productDetailLayout">
        <div className="detailMedia">
          {media ? (
            <img src={media} alt={product.title} />
          ) : (
            <div className="detailMediaFallback" aria-label="Product image unavailable">
              <span>{product.category.name}</span>
              <strong>{product.title.charAt(0)}</strong>
            </div>
          )}
        </div>

        <div className="detailContent">
          <p className="productCategory">{product.category.name}</p>
          <h1>{product.title}</h1>
          <p className="detailType">{product.product_type}</p>
          <p className="detailDescription">{product.description}</p>

          <ProductDetailSelector product={product} />
        </div>
      </section>
    </main>
  );
}

function ProductDetailErrorState({ error }: { error: unknown }) {
  const isContractError = error instanceof ProductDetailFetchError;
  const code = isContractError ? error.code : "product_detail_request_failed";
  const unpublished = code === "product_detail_unpublished";
  const notFound = code === "product_detail_not_found";

  return (
    <main className="productDetailShell">
      <a className="detailBackLink" href="/">
        Back to catalog
      </a>
      <section className="detailState" role="status" data-detail-state={code}>
        <p className="sectionLabel">
          {unpublished || notFound ? "Product unavailable" : "Service unavailable"}
        </p>
        <h1>
          {unpublished
            ? "This product is not published"
            : notFound
              ? "Product not found"
              : "Product details could not be loaded"}
        </h1>
        <p>
          {unpublished || notFound
            ? "Return to the catalog to choose another product."
            : "Try opening this product again later."}
        </p>
      </section>
    </main>
  );
}
