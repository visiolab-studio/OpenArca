import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookmarkPlus, RotateCcw, Trash2 } from "lucide-react";
import { getTickets } from "../api/tickets";
import { getProjects } from "../api/projects";
import StatusBadge from "../components/StatusBadge";
import PriorityBadge from "../components/PriorityBadge";
import ProjectBadge from "../components/ProjectBadge";
import SupportThreadOriginBadge, { matchesSupportThreadOrigin } from "../components/SupportThreadOriginBadge";
import { useAuth } from "../contexts/AuthContext";
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS, STATUS_OPTIONS } from "../utils/constants";
import { formatDateShort } from "../utils/format";
import {
  areFiltersEqual,
  createSavedView,
  loadSavedViewsState,
  normalizeFilters,
  saveSavedViewsState
} from "../utils/savedViews";

const SORT_OPTIONS = ["created_at", "updated_at", "priority"];
const SAVED_VIEWS_STORAGE_KEY = "openarca.myTickets.savedViews.v1";
const DEFAULT_FILTERS = {
  status: "",
  priority: "",
  category: "",
  projectId: "",
  origin: "",
  dateFrom: "",
  dateTo: "",
  sortBy: "updated_at"
};

function priorityWeight(priority) {
  return { critical: 0, high: 1, normal: 2, low: 3 }[priority] ?? 99;
}

function getThisWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    dateFrom: monday.toISOString().slice(0, 10),
    dateTo: sunday.toISOString().slice(0, 10)
  };
}

export default function MyTicketsPage() {
  const { t } = useTranslation();
  const { isDeveloper } = useAuth();
  const initialSavedViewState = loadSavedViewsState(SAVED_VIEWS_STORAGE_KEY, DEFAULT_FILTERS);
  const [projects, setProjects] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(initialSavedViewState.activeFilters);
  const [savedViews, setSavedViews] = useState(initialSavedViewState.views);
  const [selectedSavedViewId, setSelectedSavedViewId] = useState("");
  const [viewName, setViewName] = useState("");

  const quickViews = useMemo(() => {
    const thisWeek = getThisWeekRange();
    return [
      {
        key: "critical",
        label: t("tickets.quickViewCritical"),
        filters: { ...DEFAULT_FILTERS, priority: "critical", sortBy: "priority" }
      },
      {
        key: "waiting",
        label: t("tickets.quickViewWaiting"),
        filters: { ...DEFAULT_FILTERS, status: "waiting", sortBy: "updated_at" }
      },
      {
        key: "blocked",
        label: t("tickets.quickViewBlocked"),
        filters: { ...DEFAULT_FILTERS, status: "blocked", sortBy: "updated_at" }
      },
      {
        key: "this_week",
        label: t("tickets.quickViewThisWeek"),
        filters: { ...DEFAULT_FILTERS, ...thisWeek, sortBy: "created_at" }
      },
      {
        key: "quick_support",
        label: t("tickets.quickViewQuickSupport"),
        filters: { ...DEFAULT_FILTERS, origin: "support_thread", sortBy: "updated_at" }
      }
    ];
  }, [t]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      try {
        const [projectRows, ticketRows] = await Promise.all([getProjects(), getTickets({ my: "1" })]);
        if (!active) return;
        setProjects(projectRows);
        setTickets(ticketRows);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    saveSavedViewsState(SAVED_VIEWS_STORAGE_KEY, DEFAULT_FILTERS, {
      activeFilters: filters,
      views: savedViews
    });
  }, [filters, savedViews]);

  function updateFilters(patch) {
    setSelectedSavedViewId("");
    setFilters((current) => normalizeFilters({ ...current, ...patch }, DEFAULT_FILTERS));
  }

  function applyFilters(nextFilters, selectedViewId = "") {
    setSelectedSavedViewId(selectedViewId);
    setFilters(normalizeFilters(nextFilters, DEFAULT_FILTERS));
  }

  function handleApplyQuickView(quickView) {
    setViewName("");
    applyFilters(quickView.filters);
  }

  function handleResetFilters() {
    setViewName("");
    applyFilters(DEFAULT_FILTERS);
  }

  function handleSelectSavedView(nextViewId) {
    setSelectedSavedViewId(nextViewId);
    const nextView = savedViews.find((view) => view.id === nextViewId);
    if (!nextView) return;
    setViewName(nextView.name);
    applyFilters(nextView.filters, nextView.id);
  }

  function handleSaveView() {
    const normalizedName = viewName.trim();
    if (!normalizedName) return;

    if (selectedSavedViewId) {
      setSavedViews((current) =>
        current.map((view) =>
          view.id === selectedSavedViewId
            ? {
                ...view,
                name: normalizedName,
                filters: normalizeFilters(filters, DEFAULT_FILTERS)
              }
            : view
        )
      );
      return;
    }

    const nextView = createSavedView(normalizedName, filters, DEFAULT_FILTERS);
    setSelectedSavedViewId(nextView.id);
    setSavedViews((current) => {
      return [...current, nextView];
    });
  }

  function handleDeleteView() {
    if (!selectedSavedViewId) return;

    setSavedViews((current) => current.filter((view) => view.id !== selectedSavedViewId));
    setSelectedSavedViewId("");
    setViewName("");
  }

  const filteredTickets = useMemo(() => {
    let rows = [...tickets];

    if (filters.status) rows = rows.filter((ticket) => ticket.status === filters.status);
    if (filters.priority) rows = rows.filter((ticket) => ticket.priority === filters.priority);
    if (filters.category) rows = rows.filter((ticket) => ticket.category === filters.category);
    if (filters.projectId) rows = rows.filter((ticket) => ticket.project_id === filters.projectId);
    if (filters.origin) {
      rows = rows.filter((ticket) => matchesSupportThreadOrigin(filters.origin, ticket.source_support_thread_id));
    }

    if (filters.dateFrom) {
      rows = rows.filter((ticket) => String(ticket.created_at).slice(0, 10) >= filters.dateFrom);
    }

    if (filters.dateTo) {
      rows = rows.filter((ticket) => String(ticket.created_at).slice(0, 10) <= filters.dateTo);
    }

    if (filters.sortBy === "priority") {
      rows.sort((a, b) => priorityWeight(a.priority) - priorityWeight(b.priority));
    } else {
      rows.sort((a, b) => String(b[filters.sortBy]).localeCompare(String(a[filters.sortBy])));
    }

    return rows;
  }, [tickets, filters]);

  return (
    <section className="page-content">
      <header className="page-header">
        <h1>{t("tickets.myTitle")}</h1>
      </header>

      <article className="card form-grid filters-grid">
        <h2>{t("tickets.filters")}</h2>
        <div className="saved-views-bar form-group-wide">
          <div className="saved-views-header">
            <span className="form-label">{t("tickets.quickFilters")}</span>
            <span className="form-hint">{t("tickets.savedViewsHint")}</span>
          </div>
          <div className="saved-views-chips">
            {quickViews.map((quickView) => (
              <button
                key={quickView.key}
                type="button"
                className={
                  areFiltersEqual(filters, quickView.filters, DEFAULT_FILTERS)
                    ? "btn btn-accent"
                    : "btn btn-secondary"
                }
                onClick={() => handleApplyQuickView(quickView)}
              >
                {quickView.label}
              </button>
            ))}
            <button type="button" className="btn btn-secondary" onClick={handleResetFilters}>
              <RotateCcw size={14} />
              <span>{t("tickets.resetFilters")}</span>
            </button>
          </div>
        </div>

        <label>
          {t("tickets.savedViews")}
          <select value={selectedSavedViewId} onChange={(event) => handleSelectSavedView(event.target.value)}>
            <option value="">{t("tickets.noSavedViews")}</option>
            {savedViews.map((view) => (
              <option key={view.id} value={view.id}>
                {view.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t("tickets.savedViewName")}
          <input
            type="text"
            value={viewName}
            placeholder={t("tickets.savedViewNamePlaceholder")}
            onChange={(event) => setViewName(event.target.value)}
          />
        </label>

        <div className="form-group saved-view-actions">
          <span className="form-label">{t("tickets.applySavedView")}</span>
          <div className="row-actions">
            <button type="button" className="btn btn-accent" onClick={handleSaveView} disabled={!viewName.trim()}>
              <BookmarkPlus size={14} />
              <span>{selectedSavedViewId ? t("app.save") : t("tickets.saveView")}</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDeleteView}
              disabled={!selectedSavedViewId}
            >
              <Trash2 size={14} />
              <span>{t("tickets.deleteView")}</span>
            </button>
          </div>
        </div>

        <label>
          {t("tickets.status")}
          <select value={filters.status} onChange={(event) => updateFilters({ status: event.target.value })}>
            <option value="">-</option>
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`status.${value}`)}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t("tickets.priority")}
          <select value={filters.priority} onChange={(event) => updateFilters({ priority: event.target.value })}>
            <option value="">-</option>
            {PRIORITY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`priority.${value}`)}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t("tickets.category")}
          <select value={filters.category} onChange={(event) => updateFilters({ category: event.target.value })}>
            <option value="">-</option>
            {CATEGORY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`category.${value}`)}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t("tickets.project")}
          <select value={filters.projectId} onChange={(event) => updateFilters({ projectId: event.target.value })}>
            <option value="">-</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t("tickets.origin")}
          <select value={filters.origin} onChange={(event) => updateFilters({ origin: event.target.value })}>
            <option value="">-</option>
            <option value="support_thread">{t("tickets.originSupportThread")}</option>
            <option value="standard">{t("tickets.originStandard")}</option>
          </select>
        </label>

        <label>
          {t("tickets.dateFrom")}
          <input type="date" value={filters.dateFrom} onChange={(event) => updateFilters({ dateFrom: event.target.value })} />
        </label>

        <label>
          {t("tickets.dateTo")}
          <input type="date" value={filters.dateTo} onChange={(event) => updateFilters({ dateTo: event.target.value })} />
        </label>

        <label>
          {t("tickets.sortBy")}
          <select value={filters.sortBy} onChange={(event) => updateFilters({ sortBy: event.target.value })}>
            {SORT_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`tickets.${value === "created_at" ? "createdAt" : value === "updated_at" ? "updatedAt" : "priority"}`)}
              </option>
            ))}
          </select>
        </label>
      </article>

      <article className="card table-wrap">
        {loading ? <p>{t("app.loading")}</p> : null}
        {!loading && filteredTickets.length === 0 ? <p>{t("tickets.noTickets")}</p> : null}

        {!loading && filteredTickets.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{t("tickets.titleField")}</th>
                <th>{t("tickets.project")}</th>
                <th>{t("tickets.category")}</th>
                <th>{t("tickets.priority")}</th>
                <th>{t("tickets.status")}</th>
                <th>{t("tickets.createdAt")}</th>
                <th>{t("tickets.plannedDate")}</th>
                <th>{t("tickets.updatedAt")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td>#{String(ticket.number).padStart(3, "0")}</td>
                  <td>
                    <div className="ticket-title-cell">
                      <Link to={`/ticket/${ticket.id}`}>{ticket.title}</Link>
                      <SupportThreadOriginBadge
                        threadId={ticket.source_support_thread_id}
                        isDeveloper={isDeveloper}
                      />
                    </div>
                  </td>
                  <td>
                    <ProjectBadge
                      name={ticket.project_name || projects.find((project) => project.id === ticket.project_id)?.name}
                      color={ticket.project_color}
                      iconUrl={ticket.project_icon_url || projects.find((project) => project.id === ticket.project_id)?.icon_url}
                      showEmpty
                    />
                  </td>
                  <td>{t(`category.${ticket.category}`)}</td>
                  <td><PriorityBadge priority={ticket.priority} /></td>
                  <td><StatusBadge status={ticket.status} /></td>
                  <td>{formatDateShort(ticket.created_at)}</td>
                  <td>{formatDateShort(ticket.planned_date)}</td>
                  <td>{formatDateShort(ticket.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </article>
    </section>
  );
}
