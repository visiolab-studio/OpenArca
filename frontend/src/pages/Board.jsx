import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BookmarkPlus, CalendarDays, RotateCcw, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { getBoard, patchTicket } from "../api/tickets";
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS, STATUS_OPTIONS } from "../utils/constants";
import PriorityBadge from "../components/PriorityBadge";
import ProjectBadge from "../components/ProjectBadge";
import StatusBadge from "../components/StatusBadge";
import SupportThreadOriginBadge from "../components/SupportThreadOriginBadge";
import { useAuth } from "../contexts/AuthContext";
import {
  areFiltersEqual,
  createSavedView,
  loadSavedViewsState,
  normalizeFilters,
  saveSavedViewsState
} from "../utils/savedViews";

const columnClasses = {
  submitted: "col-submitted",
  verified: "col-verified",
  in_progress: "col-in_progress",
  waiting: "col-waiting",
  blocked: "col-blocked",
  closed: "col-closed"
};

const SAVED_VIEWS_STORAGE_KEY = "openarca.board.savedViews.v1";
const DEFAULT_FILTERS = {
  projectId: "",
  category: "",
  priority: "",
  statusScope: "",
  plannedWindow: ""
};

function getThisWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    dateFrom: monday.toISOString().slice(0, 10),
    dateTo: sunday.toISOString().slice(0, 10)
  };
}

function findContainer(columns, id) {
  if (STATUS_OPTIONS.includes(id)) {
    return id;
  }

  for (const status of STATUS_OPTIONS) {
    if ((columns[status] || []).some((ticket) => ticket.id === id)) {
      return status;
    }
  }

  return null;
}

function isOverdue(plannedDate) {
  if (!plannedDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return String(plannedDate).slice(0, 10) < today;
}

function toPreviewDraft(ticket) {
  return {
    title: ticket.title || "",
    status: ticket.status || "submitted",
    priority: ticket.priority || "normal",
    planned_date: ticket.planned_date || ""
  };
}

function TicketCard({ ticket, muted = false, onOpenPreview, isDeveloper }) {
  return (
    <article
      className={`kanban-card${muted ? " dragging" : ""}`}
      data-priority={ticket.priority || "normal"}
    >
      <div className="kanban-card-number">#{String(ticket.number).padStart(3, "0")}</div>
      {onOpenPreview ? (
        <button
          type="button"
          className="kanban-card-title-btn"
          onClick={(event) => {
            event.stopPropagation();
            onOpenPreview(ticket);
          }}
        >
          <span className="kanban-card-title">{ticket.title}</span>
        </button>
      ) : (
        <p className="kanban-card-title">{ticket.title}</p>
      )}
      <SupportThreadOriginBadge
        threadId={ticket.source_support_thread_id}
        isDeveloper={isDeveloper}
        interactive={false}
        className="kanban-support-origin"
      />
      <ProjectBadge
        name={ticket.project_name}
        color={ticket.project_color}
        iconUrl={ticket.project_icon_url}
        className="kanban-project-badge"
        showEmpty
      />
      <div className="kanban-card-footer">
        <PriorityBadge priority={ticket.priority || "normal"} />
        <span className={isOverdue(ticket.planned_date) ? "kanban-card-date overdue" : "kanban-card-date"}>
          <CalendarDays size={12} />
          <span>{ticket.planned_date || "-"}</span>
        </span>
      </div>
    </article>
  );
}

function SortableTicketCard({ ticket, onOpenPreview, isDeveloper }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TicketCard ticket={ticket} onOpenPreview={onOpenPreview} isDeveloper={isDeveloper} />
    </div>
  );
}

function KanbanColumn({ title, status, tickets, collapsed, onToggle, onOpenPreview, isDeveloper }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section className={`kanban-column ${columnClasses[status] || ""}`}>
      <header className="kanban-column-header">
        <div className="kanban-column-title">
          <span className="kanban-column-indicator" />
          <span>{title}</span>
        </div>
        <button
          type="button"
          className="kanban-column-count"
          onClick={onToggle}
          disabled={!onToggle}
        >
          {tickets.length}
        </button>
      </header>

      {!collapsed ? (
        <SortableContext items={tickets.map((ticket) => ticket.id)} strategy={verticalListSortingStrategy}>
          <div ref={setNodeRef} className="kanban-cards" id={status}>
            {isOver ? <div className="kanban-drop-zone active">Drop</div> : null}
            {tickets.map((ticket) => (
              <SortableTicketCard
                key={ticket.id}
                ticket={ticket}
                onOpenPreview={onOpenPreview}
                isDeveloper={isDeveloper}
              />
            ))}
          </div>
        </SortableContext>
      ) : null}
    </section>
  );
}

export default function BoardPage() {
  const { t } = useTranslation();
  const { isDeveloper } = useAuth();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const initialSavedViewsState = loadSavedViewsState(SAVED_VIEWS_STORAGE_KEY, DEFAULT_FILTERS);

  const [columns, setColumns] = useState(() =>
    Object.fromEntries(STATUS_OPTIONS.map((status) => [status, []]))
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [collapsedClosed, setCollapsedClosed] = useState(true);

  const [filters, setFilters] = useState(initialSavedViewsState.activeFilters);
  const [savedViews, setSavedViews] = useState(initialSavedViewsState.views);
  const [selectedSavedViewId, setSelectedSavedViewId] = useState("");
  const [viewName, setViewName] = useState("");
  const [previewTicketId, setPreviewTicketId] = useState("");
  const [previewDraft, setPreviewDraft] = useState(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  const loadBoard = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    setError("");
    try {
      const response = await getBoard();
      const next = Object.fromEntries(STATUS_OPTIONS.map((status) => [status, response[status] || []]));
      setColumns(next);
      return next;
    } catch (loadError) {
      setError(loadError?.response?.data?.error || loadError.message || "internal_error");
      return null;
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      const next = await loadBoard(true);
      if (!active || !next) return;
    }

    load();
    return () => {
      active = false;
    };
  }, [loadBoard]);

  useEffect(() => {
    if (!previewTicketId) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape" && !previewBusy) {
        setPreviewTicketId("");
        setPreviewDraft(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewTicketId, previewBusy]);

  const allProjects = useMemo(() => {
    const set = new Map();
    for (const status of STATUS_OPTIONS) {
      for (const ticket of columns[status]) {
        if (ticket.project_id) {
          set.set(ticket.project_id, ticket.project_name || ticket.project_id);
        }
      }
    }
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [columns]);

  const quickViews = useMemo(() => {
    return [
      {
        key: "critical",
        label: t("board.quickViewCritical"),
        filters: { ...DEFAULT_FILTERS, priority: "critical" }
      },
      {
        key: "waiting",
        label: t("board.quickViewWaiting"),
        filters: { ...DEFAULT_FILTERS, statusScope: "waiting" }
      },
      {
        key: "blocked",
        label: t("board.quickViewBlocked"),
        filters: { ...DEFAULT_FILTERS, statusScope: "blocked" }
      },
      {
        key: "this_week",
        label: t("board.quickViewThisWeek"),
        filters: { ...DEFAULT_FILTERS, plannedWindow: "this_week" }
      }
    ];
  }, [t]);

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

  function applyFilters(nextFilters, nextViewId = "") {
    setSelectedSavedViewId(nextViewId);
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
    setSavedViews((current) => [...current, nextView]);
  }

  function handleDeleteView() {
    if (!selectedSavedViewId) return;
    setSavedViews((current) => current.filter((view) => view.id !== selectedSavedViewId));
    setSelectedSavedViewId("");
    setViewName("");
  }

  const filteredColumns = useMemo(() => {
    const thisWeek = getThisWeekRange();
    const matches = (ticket) => {
      if (filters.projectId && ticket.project_id !== filters.projectId) return false;
      if (filters.category && ticket.category !== filters.category) return false;
      if (filters.priority && ticket.priority !== filters.priority) return false;
      if (filters.statusScope && ticket.status !== filters.statusScope) return false;
      if (filters.plannedWindow === "this_week") {
        const plannedDate = String(ticket.planned_date || "").slice(0, 10);
        if (!plannedDate) return false;
        if (plannedDate < thisWeek.dateFrom || plannedDate > thisWeek.dateTo) return false;
      }
      return true;
    };

    return Object.fromEntries(
      STATUS_OPTIONS.map((status) => [status, (columns[status] || []).filter(matches)])
    );
  }, [columns, filters]);

  const activeTicket = useMemo(() => {
    if (!activeId) return null;
    for (const status of STATUS_OPTIONS) {
      const found = columns[status].find((ticket) => ticket.id === activeId);
      if (found) return found;
    }
    return null;
  }, [activeId, columns]);

  const previewTicket = useMemo(() => {
    if (!previewTicketId) return null;
    for (const status of STATUS_OPTIONS) {
      const found = columns[status].find((ticket) => ticket.id === previewTicketId);
      if (found) return found;
    }
    return null;
  }, [columns, previewTicketId]);

  useEffect(() => {
    if (!previewTicketId) return;
    if (!previewTicket) {
      setPreviewTicketId("");
      setPreviewDraft(null);
      return;
    }
    if (!previewBusy && !previewDraft) {
      setPreviewDraft(toPreviewDraft(previewTicket));
    }
  }, [previewBusy, previewDraft, previewTicket, previewTicketId]);

  function openTicketPreview(ticket) {
    setPreviewTicketId(ticket.id);
    setPreviewDraft(toPreviewDraft(ticket));
  }

  function closeTicketPreview(force = false) {
    if (previewBusy && !force) return;
    setPreviewTicketId("");
    setPreviewDraft(null);
  }

  function patchPreviewDraft(patch) {
    setPreviewDraft((current) => ({
      ...(current || {}),
      ...patch
    }));
  }

  async function savePreviewChanges() {
    if (!previewTicket || !previewDraft) return;

    const payload = {};
    const nextTitle = String(previewDraft.title || "").trim();
    if (nextTitle && nextTitle !== previewTicket.title) {
      payload.title = nextTitle;
    }
    if (previewDraft.status && previewDraft.status !== previewTicket.status) {
      payload.status = previewDraft.status;
    }
    if (previewDraft.priority && previewDraft.priority !== previewTicket.priority) {
      payload.priority = previewDraft.priority;
    }

    const currentPlanned = previewTicket.planned_date || null;
    const nextPlanned = previewDraft.planned_date || null;
    if (currentPlanned !== nextPlanned) {
      payload.planned_date = nextPlanned;
    }

    if (Object.keys(payload).length === 0) {
      closeTicketPreview();
      return;
    }

    try {
      setPreviewBusy(true);
      setError("");
      await patchTicket(previewTicket.id, payload);
      await loadBoard(false);
      closeTicketPreview(true);
    } catch (patchError) {
      setError(patchError?.response?.data?.error || patchError.message || "internal_error");
    } finally {
      setPreviewBusy(false);
    }
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const source = findContainer(columns, active.id);
    const target = findContainer(columns, over.id);

    if (!source || !target || source === target) {
      return;
    }

    const sourceItems = columns[source] || [];
    const ticket = sourceItems.find((item) => item.id === active.id);
    if (!ticket) return;

    const previous = columns;
    const optimistic = {
      ...columns,
      [source]: sourceItems.filter((item) => item.id !== ticket.id),
      [target]: [{ ...ticket, status: target }, ...(columns[target] || [])]
    };

    setColumns(optimistic);

    try {
      await patchTicket(ticket.id, { status: target });
    } catch (patchError) {
      setColumns(previous);
      setError(patchError?.response?.data?.error || patchError.message || "internal_error");
    }
  }

  return (
    <section className="page-content page-content--full">
      <article className="card form-grid filters-grid">
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

        <label className="form-group">
          <span className="form-label">{t("tickets.savedViews")}</span>
          <select className="form-select" value={selectedSavedViewId} onChange={(event) => handleSelectSavedView(event.target.value)}>
            <option value="">{t("tickets.noSavedViews")}</option>
            {savedViews.map((view) => (
              <option key={view.id} value={view.id}>
                {view.name}
              </option>
            ))}
          </select>
        </label>

        <label className="form-group">
          <span className="form-label">{t("tickets.savedViewName")}</span>
          <input
            className="form-input"
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

        <label className="form-group">
          <span className="form-label">{t("tickets.project")}</span>
          <select className="form-select" value={filters.projectId} onChange={(event) => updateFilters({ projectId: event.target.value })}>
            <option value="">-</option>
            {allProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <label className="form-group">
          <span className="form-label">{t("tickets.category")}</span>
          <select className="form-select" value={filters.category} onChange={(event) => updateFilters({ category: event.target.value })}>
            <option value="">-</option>
            {CATEGORY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`category.${value}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="form-group">
          <span className="form-label">{t("tickets.priority")}</span>
          <select className="form-select" value={filters.priority} onChange={(event) => updateFilters({ priority: event.target.value })}>
            <option value="">-</option>
            {PRIORITY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`priority.${value}`)}
              </option>
            ))}
          </select>
        </label>
      </article>

      {error ? <p className="feedback err">{t(`errors.${error}`, { defaultValue: error })}</p> : null}
      {loading ? <section className="card">{t("app.loading")}</section> : null}

      {previewTicket && previewDraft ? (
        <div className="todo-modal-backdrop" onClick={closeTicketPreview}>
          <article className="card todo-create-modal kanban-preview-modal" onClick={(event) => event.stopPropagation()}>
            <div className="todo-create-modal-header">
              <h2 className="card-title">{t("board.previewTitle")}</h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={closeTicketPreview}
                disabled={previewBusy}
              >
                <X size={12} />
                <span>{t("app.cancel")}</span>
              </button>
            </div>

            <div className="form-grid">
              <div className="row-actions">
                <span className="ticket-number">#{String(previewTicket.number).padStart(3, "0")}</span>
                <PriorityBadge priority={previewTicket.priority || "normal"} />
                <StatusBadge status={previewTicket.status} />
                <SupportThreadOriginBadge
                  threadId={previewTicket.source_support_thread_id}
                  isDeveloper={isDeveloper}
                />
                <ProjectBadge
                  name={previewTicket.project_name}
                  color={previewTicket.project_color}
                  iconUrl={previewTicket.project_icon_url}
                  showEmpty
                />
              </div>

              <label className="form-group">
                <span className="form-label">{t("tickets.titleField")}</span>
                <input
                  className="form-input"
                  type="text"
                  value={previewDraft.title}
                  onChange={(event) => patchPreviewDraft({ title: event.target.value })}
                />
              </label>

              <section className="form-group">
                <span className="form-label">{t("board.descriptionLabel")}</span>
                <div className="kanban-preview-description">
                  {previewTicket.description || t("board.noDescription")}
                </div>
              </section>

              <div className="filters-grid">
                <label className="form-group">
                  <span className="form-label">{t("tickets.status")}</span>
                  <select
                    className="form-select"
                    value={previewDraft.status}
                    onChange={(event) => patchPreviewDraft({ status: event.target.value })}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {t(`status.${status}`)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-group">
                  <span className="form-label">{t("tickets.priority")}</span>
                  <select
                    className="form-select"
                    value={previewDraft.priority}
                    onChange={(event) => patchPreviewDraft({ priority: event.target.value })}
                  >
                    {PRIORITY_OPTIONS.map((priority) => (
                      <option key={priority} value={priority}>
                        {t(`priority.${priority}`)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-group">
                  <span className="form-label">{t("tickets.plannedDate")}</span>
                  <input
                    className="form-input"
                    type="date"
                    value={previewDraft.planned_date}
                    onChange={(event) => patchPreviewDraft({ planned_date: event.target.value })}
                  />
                </label>
              </div>

              <div className="kanban-preview-actions">
                <Link to={`/ticket/${previewTicket.id}`} className="btn btn-secondary">
                  {t("board.openDetails")}
                </Link>
                <button type="button" className="btn btn-accent" onClick={savePreviewChanges} disabled={previewBusy}>
                  {previewBusy ? t("app.loading") : t("app.save")}
                </button>
              </div>
            </div>
          </article>
        </div>
      ) : null}

      {!loading ? (
        <DndContext
          sensors={sensors}
          onDragStart={(event) => setActiveId(event.active.id)}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="kanban-board">
            {STATUS_OPTIONS.map((status) => (
              <KanbanColumn
                key={status}
                title={t(`status.${status}`)}
                status={status}
                tickets={filteredColumns[status] || []}
                collapsed={status === "closed" ? collapsedClosed : false}
                onToggle={status === "closed" ? () => setCollapsedClosed((current) => !current) : undefined}
                onOpenPreview={openTicketPreview}
                isDeveloper={isDeveloper}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTicket ? <TicketCard ticket={activeTicket} muted isDeveloper={isDeveloper} /> : null}
          </DragOverlay>
        </DndContext>
      ) : null}
    </section>
  );
}
