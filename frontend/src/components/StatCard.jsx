import StatusBadge from "./StatusBadge";

export default function StatCard({ statusKey, count }) {
  return (
    <article className={`stat-card stat-card-${statusKey}`}>
      <StatusBadge status={statusKey} />
      <strong className="stat-card-value">{count}</strong>
    </article>
  );
}
