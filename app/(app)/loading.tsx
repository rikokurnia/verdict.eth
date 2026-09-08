export default function AppLoading() {
  return (
    <>
      <div className="v-page-head">
        <div className="v-skeleton" style={{ width: 280, height: 44 }} />
        <div className="v-skeleton" style={{ width: 'min(480px,80%)', height: 18, marginTop: 10 }} />
      </div>
      <div className="v-grid v-cards-4" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div className="v-card" key={i}><div className="v-skeleton" style={{ height: 86 }} /></div>
        ))}
      </div>
      <p className="v-muted" role="status">Resolving ENS… reading authority records… evaluating policy…</p>
    </>
  );
}
