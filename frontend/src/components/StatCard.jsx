import StatusBadge from "./StatusBadge";

export default function StatCard({ statusKey, count }) {
  return (
    <article className="stat-card">
      <StatusBadge status={statusKey} />
      <strong>{count}</strong>
    </article>
  );
}
