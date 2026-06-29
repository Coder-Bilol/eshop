export default function ProductDetailLoading() {
  return (
    <main className="productDetailShell" aria-busy="true">
      <div className="detailLoadingHeader" />
      <section className="productDetailLayout">
        <div className="detailLoadingMedia" />
        <div className="detailLoadingContent">
          <div />
          <div />
          <div />
          <div />
        </div>
      </section>
      <span className="srOnly">Loading product details</span>
    </main>
  );
}
