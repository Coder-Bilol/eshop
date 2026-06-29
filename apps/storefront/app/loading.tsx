export default function CatalogLoading() {
  return (
    <main className="catalogShell">
      <header className="catalogHeader">
        <div>
          <p className="eyebrow">Eshop catalog</p>
          <h1>Home goods</h1>
        </div>
      </header>

      <section
        className="catalogState"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <h2>Loading catalog</h2>
        <p>Fetching current products and filters.</p>
      </section>
    </main>
  );
}
