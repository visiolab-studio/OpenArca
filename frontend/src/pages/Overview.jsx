import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getOverviewStats, getOverviewWorkload } from "../api/tickets";
import StatusBadge from "../components/StatusBadge";
import PriorityBadge from "../components/PriorityBadge";
import { formatDateShort } from "../utils/format";

function personLabel(name, email, fallback) {
  const normalizedName = String(name || "").trim();
  if (normalizedName) return normalizedName;

  const normalizedEmail = String(email || "").trim();
  if (normalizedEmail) return normalizedEmail;

  return fallback;
}

function WorkloadRow({ ticket, t }) {
  const assignee = personLabel(
    ticket.assignee_name,
    ticket.assignee_email,
    t("overview.assigneeMissing")
  );
  const reporter = personLabel(ticket.reporter_name, ticket.reporter_email, "-");
  const rowClass = `ticket-row-link workload-row ${ticket.can_open ? "" : "workload-row-readonly"}`;
  const content = (
    <>
      <div className="workload-row-head">
        <span className="workload-row-title">
          #{String(ticket.number).padStart(3, "0")} · {ticket.title}
        </span>
        <div className="row-actions">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
        </div>
      </div>

      <div className="workload-row-meta">
        <span className="workload-meta-item">
          <span className="workload-meta-label">{t("tickets.plannedDate")}</span>
          <span>{formatDateShort(ticket.planned_date)}</span>
        </span>
        <span className="workload-meta-item">
          <span className="workload-meta-label">{t("tickets.assignee")}</span>
          <span>{assignee}</span>
        </span>
        <span className="workload-meta-item">
          <span className="workload-meta-label">{t("overview.reporter")}</span>
          <span>{reporter}</span>
        </span>
        <span className="workload-meta-item">
          <span className="workload-meta-label">{t("tickets.updatedAt")}</span>
          <span>{formatDateShort(ticket.updated_at)}</span>
        </span>
      </div>

      {!ticket.can_open ? <span className="workload-row-note">{t("overview.readOnly")}</span> : null}
    </>
  );

  if (!ticket.can_open) {
    return <div className={rowClass}>{content}</div>;
  }

  return (
    <Link to={`/ticket/${ticket.id}`} className={rowClass}>
      {content}
    </Link>
  );
}

function WorkloadSection({ title, description, tickets, t, primary = false }) {
  return (
    <article className={`card workload-card ${primary ? "workload-card-primary" : ""}`}>
      <header className="workload-card-header">
        <div>
          <h2 className="card-title">{title}</h2>
          <p className="workload-card-description">{description}</p>
        </div>
        <span className="workload-count">{tickets.length}</span>
      </header>

      {tickets.length === 0 ? (
        <p className="muted">{t("overview.empty")}</p>
      ) : (
        <ul className="list-plain workload-list">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <WorkloadRow ticket={ticket} t={t} />
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export default function OverviewPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [workload, setWorkload] = useState({
    in_progress: [],
    queue: [],
    blocked: [],
    submitted: [],
    _stats: {
      in_progress: 0,
      queue: 0,
      blocked: 0,
      submitted: 0,
      open: 0
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      try {
        const [statsData, workloadData] = await Promise.all([
          getOverviewStats(),
          getOverviewWorkload()
        ]);

        if (!active) return;
        setStats(statsData);
        setWorkload(workloadData);
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

  const inProgressCount = workload._stats?.in_progress ?? stats?.in_progress ?? 0;
  const queueCount = workload._stats?.queue ?? ((stats?.verified || 0) + (stats?.waiting || 0));
  const blockedCount = workload._stats?.blocked ?? stats?.blocked ?? 0;
  const submittedCount = workload._stats?.submitted ?? stats?.submitted ?? 0;
  const openCount = workload._stats?.open
    ?? (stats?.submitted || 0) + (stats?.verified || 0) + (stats?.in_progress || 0)
    + (stats?.waiting || 0) + (stats?.blocked || 0);

  return (
    <section className="page-content overview-page">
      <header className="page-header overview-header">
        <div>
          <h1 className="page-title">{t("overview.title")}</h1>
          <p className="overview-subtitle">{t("overview.subtitle")}</p>
        </div>
      </header>

      <div className="dashboard-stats overview-stats">
        <article className="stat-card stat-card-in_progress">
          <span className="badge badge-in_progress">{t("overview.inProgressList")}</span>
          <strong className="stat-card-value">{inProgressCount}</strong>
          <span className="muted">{t("overview.inProgressHint")}</span>
        </article>

        <article className="stat-card stat-card-queue">
          <span className="badge badge-waiting">{t("overview.queueList")}</span>
          <strong className="stat-card-value">{queueCount}</strong>
          <span className="muted">{t("overview.queueHint")}</span>
        </article>

        <article className="stat-card stat-card-blocked">
          <span className="badge badge-blocked">{t("overview.blockedList")}</span>
          <strong className="stat-card-value">{blockedCount}</strong>
          <span className="muted">{t("overview.blockedHint")}</span>
        </article>

        <article className="stat-card stat-card-submitted">
          <span className="badge badge-submitted">{t("overview.submittedList")}</span>
          <strong className="stat-card-value">{submittedCount}</strong>
          <span className="muted">{t("overview.submittedHint")}</span>
        </article>

        <article className="stat-card">
          <span className="badge badge-no-dot">{t("overview.totalOpen")}</span>
          <strong className="stat-card-value">{openCount}</strong>
          <span className="muted">{t("overview.totalHint")}</span>
        </article>
      </div>

      <div className="overview-lists">
        <WorkloadSection
          title={t("overview.inProgressList")}
          description={t("overview.inProgressHint")}
          tickets={workload.in_progress || []}
          t={t}
          primary
        />
        <WorkloadSection
          title={t("overview.queueList")}
          description={t("overview.queueHint")}
          tickets={workload.queue || []}
          t={t}
        />
        <WorkloadSection
          title={t("overview.blockedList")}
          description={t("overview.blockedHint")}
          tickets={workload.blocked || []}
          t={t}
        />
        <WorkloadSection
          title={t("overview.submittedList")}
          description={t("overview.submittedHint")}
          tickets={workload.submitted || []}
          t={t}
        />
      </div>
    </section>
  );
}
