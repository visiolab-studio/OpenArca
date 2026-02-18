import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getOverviewStats, getTickets } from "../api/tickets";
import { getDevTasks } from "../api/devTasks";
import { useAuth } from "../contexts/AuthContext";
import StatusBadge from "../components/StatusBadge";
import StatCard from "../components/StatCard";
import { formatDate } from "../utils/format";

export default function DashboardPage() {
  const { t } = useTranslation();
  const { isDeveloper } = useAuth();

  const [stats, setStats] = useState(null);
  const [latest, setLatest] = useState([]);
  const [todoCount, setTodoCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      try {
        const [statsData, ticketData, devTaskData] = await Promise.all([
          getOverviewStats(),
          getTickets(),
          isDeveloper ? getDevTasks() : Promise.resolve({ active: [] })
        ]);

        if (!active) return;
        setStats(statsData);
        setLatest(ticketData.slice(0, 8));
        setTodoCount(devTaskData.active?.length || 0);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [isDeveloper]);

  if (loading) {
    return <section className="card">{t("app.loading")}</section>;
  }

  return (
    <section className="page-content">
      <header className="page-header">
        <h1>{t("dashboard.title")}</h1>
        <p>{t("dashboard.subtitle")}</p>
      </header>

      <div className="stats-grid">
        <StatCard statusKey="submitted" count={stats?.submitted || 0} />
        <StatCard statusKey="verified" count={stats?.verified || 0} />
        <StatCard statusKey="in_progress" count={stats?.in_progress || 0} />
        <StatCard statusKey="waiting" count={stats?.waiting || 0} />
        <StatCard statusKey="blocked" count={stats?.blocked || 0} />
        {isDeveloper ? (
          <article className="stat-card">
            <span className="badge">{t("dashboard.todoCount")}</span>
            <strong>{todoCount}</strong>
          </article>
        ) : null}
      </div>

      <div className="panel-grid">
        <article className="card">
          <h2>{t("dashboard.quick")}</h2>
          <div className="row-actions">
            <Link className="btn" to="/new-ticket">
              {t("dashboard.openNew")}
            </Link>
            <Link className="btn btn-ghost" to="/my-tickets">
              {t("dashboard.goMine")}
            </Link>
          </div>
        </article>

        <article className="card">
          <h2>{t("dashboard.recent")}</h2>
          {latest.length === 0 ? <p>{t("tickets.noTickets")}</p> : null}
          <ul className="list-plain">
            {latest.map((ticket) => (
              <li key={ticket.id}>
                <Link to={`/ticket/${ticket.id}`} className="ticket-row-link">
                  <span>#{String(ticket.number).padStart(3, "0")} · {ticket.title}</span>
                  <span className="muted">{formatDate(ticket.updated_at)}</span>
                  <StatusBadge status={ticket.status} />
                </Link>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
