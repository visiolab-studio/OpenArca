import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  KanbanSquare,
  ListTodo,
  PlusCircle,
  Settings,
  Ticket
} from "lucide-react";
import { getOverviewStats, getOverviewWorkload, getTickets } from "../api/tickets";
import { getDevTasks } from "../api/devTasks";
import { useAuth } from "../contexts/AuthContext";
import StatusBadge from "../components/StatusBadge";
import StatCard from "../components/StatCard";
import PriorityBadge from "../components/PriorityBadge";
import { formatDate, formatDateShort } from "../utils/format";

const EMPTY_WORKLOAD = {
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
};

function isOlderThanDays(value, days) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return false;
  const ageMs = Date.now() - timestamp;
  return ageMs > days * 24 * 60 * 60 * 1000;
}

function personLabel(name, email, fallback) {
  const normalizedName = String(name || "").trim();
  if (normalizedName) return normalizedName;
  const normalizedEmail = String(email || "").trim();
  if (normalizedEmail) return normalizedEmail;
  return fallback;
}

function DashboardWorkRow({ ticket, t }) {
  const canOpen = ticket.can_open !== false;
  const assignee = personLabel(
    ticket.assignee_name,
    ticket.assignee_email,
    t("overview.assigneeMissing")
  );
  const rowClass = `ticket-row-link workload-row ${canOpen ? "" : "workload-row-readonly"}`;
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
          <span className="workload-meta-label">{t("tickets.updatedAt")}</span>
          <span>{formatDateShort(ticket.updated_at)}</span>
        </span>
      </div>
    </>
  );

  if (!canOpen) {
    return <div className={rowClass}>{content}</div>;
  }

  return (
    <Link to={`/ticket/${ticket.id}`} className={rowClass}>
      {content}
    </Link>
  );
}

function QuickLinkTile({ to, label, Icon, tone = "default" }) {
  return (
    <Link to={to} className={`dashboard-quick-tile ${tone === "primary" ? "dashboard-quick-tile-primary" : ""}`}>
      <span className="dashboard-quick-tile-icon">
        <Icon size={18} />
      </span>
      <span className="dashboard-quick-tile-label">{label}</span>
    </Link>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { isDeveloper } = useAuth();

  const [stats, setStats] = useState(null);
  const [workload, setWorkload] = useState(EMPTY_WORKLOAD);
  const [latest, setLatest] = useState([]);
  const [todoStats, setTodoStats] = useState({ total: 0, todo: 0, inProgress: 0, withoutPlan: 0 });
  const [alerts, setAlerts] = useState({
    overdueCount: 0,
    queueUnassigned: 0,
    criticalSubmitted: 0,
    todoWithoutPlan: 0,
    blockedStale: 0,
    submittedStale: 0
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const [statsData, workloadData, ticketData, devTaskData] = await Promise.all([
          getOverviewStats(),
          getOverviewWorkload(),
          getTickets(),
          isDeveloper ? getDevTasks() : Promise.resolve({ active: [] })
        ]);

        if (!active) return;

        setStats(statsData || null);
        setWorkload(workloadData || EMPTY_WORKLOAD);
        setLatest((ticketData || []).slice(0, 8));

        if (isDeveloper) {
          const activeTasks = devTaskData?.active || [];
          const total = activeTasks.length;
          const todo = activeTasks.filter((task) => task.status === "todo").length;
          const inProgress = activeTasks.filter((task) => task.status === "in_progress").length;
          const withoutPlan = activeTasks.filter((task) => !task.planned_date).length;
          setTodoStats({ total, todo, inProgress, withoutPlan });

          const today = new Date().toISOString().slice(0, 10);
          const openQueues = [
            ...(workloadData?.in_progress || []),
            ...(workloadData?.queue || []),
            ...(workloadData?.blocked || [])
          ];
          const overdueCount = openQueues.filter(
            (ticket) =>
              ticket.planned_date && String(ticket.planned_date).slice(0, 10) < today
          ).length;
          const queueUnassigned = (workloadData?.queue || []).filter((ticket) => !ticket.assignee_id).length;
          const criticalSubmitted = (workloadData?.submitted || []).filter(
            (ticket) => ticket.priority === "critical" || ticket.priority === "high"
          ).length;
          const blockedStale = (workloadData?.blocked || []).filter(
            (ticket) => isOlderThanDays(ticket.updated_at, 3)
          ).length;
          const submittedStale = (workloadData?.submitted || []).filter(
            (ticket) => isOlderThanDays(ticket.created_at || ticket.updated_at, 1)
          ).length;

          setAlerts({
            overdueCount,
            queueUnassigned,
            criticalSubmitted,
            todoWithoutPlan: withoutPlan,
            blockedStale,
            submittedStale
          });
        }
      } catch (loadError) {
        if (!active) return;
        setError(loadError?.response?.data?.error || loadError?.message || "internal_error");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [isDeveloper]);

  const queueCount = workload._stats?.queue ?? ((stats?.verified || 0) + (stats?.waiting || 0));
  const openCount = workload._stats?.open
    ?? (stats?.submitted || 0) + (stats?.verified || 0) + (stats?.in_progress || 0)
    + (stats?.waiting || 0) + (stats?.blocked || 0);
  const focusTickets = useMemo(() => {
    if (isDeveloper) {
      return [...(workload.in_progress || []), ...(workload.queue || [])].slice(0, 8);
    }
    return latest.filter((ticket) => ticket.status !== "closed").slice(0, 8);
  }, [isDeveloper, latest, workload.in_progress, workload.queue]);
  const alertCards = useMemo(() => {
    const baseCards = [
      {
        key: "overdue",
        value: alerts.overdueCount,
        label: t("dashboard.overdue"),
        hint: t("dashboard.overdueHint"),
        severity: alerts.overdueCount > 0 ? "critical" : "ok"
      },
      {
        key: "blockedStale",
        value: alerts.blockedStale,
        label: t("dashboard.blockedStale"),
        hint: t("dashboard.blockedStaleHint"),
        severity: alerts.blockedStale > 0 ? "critical" : "ok"
      },
      {
        key: "criticalSubmitted",
        value: alerts.criticalSubmitted,
        label: t("dashboard.criticalSubmitted"),
        hint: t("dashboard.criticalSubmittedHint"),
        severity: alerts.criticalSubmitted > 0 ? "critical" : "ok"
      },
      {
        key: "queueUnassigned",
        value: alerts.queueUnassigned,
        label: t("dashboard.queueUnassigned"),
        hint: t("dashboard.queueUnassignedHint"),
        severity: alerts.queueUnassigned > 0 ? "warning" : "ok"
      },
      {
        key: "submittedStale",
        value: alerts.submittedStale,
        label: t("dashboard.submittedStale"),
        hint: t("dashboard.submittedStaleHint"),
        severity: alerts.submittedStale > 0 ? "warning" : "ok"
      },
      {
        key: "todoWithoutPlan",
        value: alerts.todoWithoutPlan,
        label: t("dashboard.todoWithoutPlan"),
        hint: t("dashboard.todoWithoutPlanHint"),
        severity: alerts.todoWithoutPlan > 0 ? "warning" : "ok"
      }
    ];

    return baseCards.map((card) => {
      const statusLabel = card.severity === "ok"
        ? t("dashboard.alertStateOk")
        : card.severity === "critical"
          ? t("dashboard.alertStateCritical")
          : t("dashboard.alertStateWarn");
      const Icon = card.severity === "ok"
        ? CheckCircle2
        : card.severity === "critical"
          ? AlertTriangle
          : Clock3;

      return {
        ...card,
        statusLabel,
        Icon
      };
    });
  }, [alerts, t]);

  if (loading) {
    return <section className="card">{t("app.loading")}</section>;
  }

  return (
    <section className="page-content overview-page">
      <header className="page-header overview-header">
        <div>
          <h1 className="page-title">{t("dashboard.title")}</h1>
          <p className="overview-subtitle">
            {isDeveloper ? t("dashboard.subtitleDev") : t("dashboard.subtitleUser")}
          </p>
        </div>
      </header>

      {error ? <p className="feedback err">{t(`errors.${error}`, { defaultValue: error })}</p> : null}

      <div className="dashboard-stats overview-stats">
        <StatCard statusKey="in_progress" count={workload._stats?.in_progress ?? stats?.in_progress ?? 0} />
        <article className="stat-card stat-card-queue">
          <span className="badge badge-waiting">{t("overview.queueList")}</span>
          <strong className="stat-card-value">{queueCount}</strong>
          <span className="muted">{t("overview.queueHint")}</span>
        </article>
        <StatCard statusKey="blocked" count={workload._stats?.blocked ?? stats?.blocked ?? 0} />
        <StatCard statusKey="submitted" count={workload._stats?.submitted ?? stats?.submitted ?? 0} />
        <article className="stat-card">
          <span className="badge badge-no-dot">{t("overview.totalOpen")}</span>
          <strong className="stat-card-value">{openCount}</strong>
          <span className="muted">{t("overview.totalHint")}</span>
        </article>
        <article className="stat-card">
          <span className="badge badge-closed">{t("dashboard.closedToday")}</span>
          <strong className="stat-card-value">{stats?.closed_today || 0}</strong>
          <span className="muted">{t("dashboard.closedTodayHint")}</span>
        </article>
        {isDeveloper ? (
          <article className="stat-card stat-card-in_progress">
            <span className="badge badge-in_progress">{t("dashboard.todoCount")}</span>
            <strong className="stat-card-value">{todoStats.total}</strong>
            <span className="muted">
              {t("dashboard.todoSplit", { inProgress: todoStats.inProgress, todo: todoStats.todo })}
            </span>
          </article>
        ) : null}
      </div>

      <div className="panel-grid">
        <article className="card">
          <h2 className="card-title">{t("dashboard.quick")}</h2>
          <div className="dashboard-quick-groups">
            <section className="dashboard-quick-group">
              <h3 className="dashboard-quick-group-title">{t("dashboard.quickBasic")}</h3>
              <div className="dashboard-quick-grid">
                <QuickLinkTile
                  to="/new-ticket"
                  label={t("dashboard.openNew")}
                  Icon={PlusCircle}
                  tone="primary"
                />
                <QuickLinkTile
                  to="/my-tickets"
                  label={t("dashboard.goMine")}
                  Icon={Ticket}
                />
                <QuickLinkTile
                  to="/overview"
                  label={t("dashboard.goOverview")}
                  Icon={BarChart3}
                />
              </div>
            </section>

            {isDeveloper ? (
              <section className="dashboard-quick-group">
                <h3 className="dashboard-quick-group-title">{t("dashboard.quickDeveloper")}</h3>
                <div className="dashboard-quick-grid">
                  <QuickLinkTile
                    to="/dev-todo"
                    label={t("dashboard.goTodo")}
                    Icon={ListTodo}
                  />
                  <QuickLinkTile
                    to="/board"
                    label={t("dashboard.goBoard")}
                    Icon={KanbanSquare}
                  />
                  <QuickLinkTile
                    to="/admin"
                    label={t("nav.admin")}
                    Icon={Settings}
                  />
                </div>
              </section>
            ) : null}
          </div>
        </article>

        <article className="card">
          <h2 className="card-title">{t("dashboard.focus")}</h2>
          <p className="muted">
            {isDeveloper ? t("dashboard.focusHintDev") : t("dashboard.focusHintUser")}
          </p>
          {focusTickets.length === 0 ? <p>{t("tickets.noTickets")}</p> : null}
          <ul className="list-plain workload-list">
            {focusTickets.map((ticket) => (
              <li key={ticket.id}>
                <DashboardWorkRow ticket={ticket} t={t} />
              </li>
            ))}
          </ul>
        </article>

        <article className="card">
          <h2 className="card-title">{t("dashboard.recent")}</h2>
          {latest.length === 0 ? <p>{t("tickets.noTickets")}</p> : null}
          <ul className="list-plain">
            {latest.map((ticket) => (
              <li key={ticket.id}>
                <Link to={`/ticket/${ticket.id}`} className="ticket-row-link">
                  <span>#{String(ticket.number).padStart(3, "0")} · {ticket.title}</span>
                  <div className="row-actions">
                    <StatusBadge status={ticket.status} />
                    <PriorityBadge priority={ticket.priority} />
                    <span className="muted">{formatDate(ticket.updated_at)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </article>

        {isDeveloper ? (
          <article className="card">
            <h2 className="card-title">{t("dashboard.alerts")}</h2>
            <p className="muted">{t("dashboard.alertsHint")}</p>
            <div className="dashboard-alert-grid">
              {alertCards.map((card) => {
                const Icon = card.Icon;
                return (
                  <article
                    key={card.key}
                    className={`dashboard-alert-item dashboard-alert-${card.severity}`}
                  >
                    <div className="dashboard-alert-head">
                      <span className="dashboard-alert-icon">
                        <Icon size={14} />
                      </span>
                      <span className="dashboard-alert-state">{card.statusLabel}</span>
                    </div>
                    <strong className="dashboard-alert-value">{card.value}</strong>
                    <span className="dashboard-alert-label">{card.label}</span>
                    <span className="dashboard-alert-hint">{card.hint}</span>
                  </article>
                );
              })}
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
