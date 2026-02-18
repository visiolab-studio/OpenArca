import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getOverviewStats, getTickets } from "../api/tickets";
import StatusBadge from "../components/StatusBadge";
import PriorityBadge from "../components/PriorityBadge";
import StatCard from "../components/StatCard";
import { formatDateShort } from "../utils/format";

export default function OverviewPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [inProgressTickets, setInProgressTickets] = useState([]);
  const [waitingTickets, setWaitingTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      try {
        const [statsData, inProgressData, waitingData] = await Promise.all([
          getOverviewStats(),
          getTickets({ status: "in_progress" }),
          getTickets({ status: "waiting" })
        ]);

        if (!active) return;
        setStats(statsData);
        setInProgressTickets(inProgressData);
        setWaitingTickets(waitingData);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <section className="card">{t("app.loading")}</section>;
  }

  return (
    <section className="page-content">
      <header className="page-header">
        <p>{t("overview.title")}</p>
      </header>

      <div className="dashboard-stats">
        <StatCard statusKey="submitted" count={stats?.submitted || 0} />
        <StatCard statusKey="verified" count={stats?.verified || 0} />
        <StatCard statusKey="in_progress" count={stats?.in_progress || 0} />
        <StatCard statusKey="waiting" count={stats?.waiting || 0} />
        <StatCard statusKey="blocked" count={stats?.blocked || 0} />
      </div>

      <div className="panel-grid">
        <article className="card">
          <h2 className="card-title">{t("overview.inProgressList")}</h2>
          <ul className="list-plain">
            {inProgressTickets.map((ticket) => (
              <li key={ticket.id}>
                <Link to={`/ticket/${ticket.id}`} className="ticket-row-link">
                  <span>#{String(ticket.number).padStart(3, "0")} · {ticket.title}</span>
                  <PriorityBadge priority={ticket.priority} />
                  <span className="muted">{formatDateShort(ticket.planned_date)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2 className="card-title">{t("overview.waitingList")}</h2>
          <ul className="list-plain">
            {waitingTickets.map((ticket) => (
              <li key={ticket.id}>
                <Link to={`/ticket/${ticket.id}`} className="ticket-row-link">
                  <span>#{String(ticket.number).padStart(3, "0")} · {ticket.title}</span>
                  <StatusBadge status={ticket.status} />
                  <span className="muted">{formatDateShort(ticket.updated_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
