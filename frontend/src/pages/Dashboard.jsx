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
  const [alerts, setAlerts] = useState({
    overdueCount: 0,
    withoutPriorityCount: 0,
    withoutPlanCount: 0
  });
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

        if (isDeveloper) {
          const today = new Date().toISOString().slice(0, 10);
          const overdueCount = ticketData.filter(
            (ticket) =>
              ticket.status !== "closed" &&
              ticket.planned_date &&
              String(ticket.planned_date).slice(0, 10) < today
          ).length;

          const withoutPriorityCount = ticketData.filter((ticket) => !ticket.priority).length;
          const withoutPlanCount = ticketData.filter(
            (ticket) =>
              ["verified", "in_progress", "waiting", "blocked"].includes(ticket.status) &&
              !ticket.planned_date
          ).length;

          setAlerts({ overdueCount, withoutPriorityCount, withoutPlanCount });
        }
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
        <p>{t("dashboard.subtitle")}</p>
      </header>

      <div className="dashboard-stats">
        <StatCard statusKey="submitted" count={stats?.submitted || 0} />
        <StatCard statusKey="verified" count={stats?.verified || 0} />
        <StatCard statusKey="in_progress" count={stats?.in_progress || 0} />
        <StatCard statusKey="waiting" count={stats?.waiting || 0} />
        <StatCard statusKey="blocked" count={stats?.blocked || 0} />
        {isDeveloper ? (
          <article className="stat-card">
            <span className="badge">{t("dashboard.todoCount")}</span>
            <strong className="stat-card-value">{todoCount}</strong>
          </article>
        ) : null}
      </div>

      <div className="panel-grid">
        <article className="card">
          <h2 className="card-title">{t("dashboard.quick")}</h2>
          <div className="row-actions">
            <Link className="btn btn-yellow" to="/new-ticket">
              {t("dashboard.openNew")}
            </Link>
            <Link className="btn btn-secondary" to="/my-tickets">
              {t("dashboard.goMine")}
            </Link>
          </div>
        </article>

        <article className="card">
          <h2 className="card-title">{t("dashboard.recent")}</h2>
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

        {isDeveloper ? (
          <article className="card">
            <h2 className="card-title">{t("dashboard.alerts")}</h2>
            <ul className="list-plain">
              <li>{t("dashboard.overdue")}: {alerts.overdueCount}</li>
              <li>{t("dashboard.withoutPriority")}: {alerts.withoutPriorityCount}</li>
              <li>{t("dashboard.withoutPlan")}: {alerts.withoutPlanCount}</li>
            </ul>
          </article>
        ) : null}
      </div>
    </section>
  );
}
