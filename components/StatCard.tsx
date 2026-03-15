export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card stat-card">
      <div className="muted stat-card-label">{label}</div>
      <div className="stat-card-value">{value}</div>
    </div>
  );
}
