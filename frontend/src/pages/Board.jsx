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
import { CalendarDays, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { getBoard, patchTicket } from "../api/tickets";
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS, STATUS_OPTIONS } from "../utils/constants";
import PriorityBadge from "../components/PriorityBadge";
import StatusBadge from "../components/StatusBadge";

const columnClasses = {
  submitted: "col-submitted",
  verified: "col-verified",
  in_progress: "col-in_progress",
  waiting: "col-waiting",
  blocked: "col-blocked",
  closed: "col-closed"
};

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

function TicketCard({ ticket, muted = false, onOpenPreview }) {
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

function SortableTicketCard({ ticket, onOpenPreview }) {
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
      <TicketCard ticket={ticket} onOpenPreview={onOpenPreview} />
    </div>
  );
}

function KanbanColumn({ title, status, tickets, collapsed, onToggle, onOpenPreview }) {
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
              <SortableTicketCard key={ticket.id} ticket={ticket} onOpenPreview={onOpenPreview} />
            ))}
          </div>
        </SortableContext>
      ) : null}
    </section>
  );
}

export default function BoardPage() {
  const { t } = useTranslation();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const [columns, setColumns] = useState(() =>
    Object.fromEntries(STATUS_OPTIONS.map((status) => [status, []]))
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [collapsedClosed, setCollapsedClosed] = useState(true);

  const [projectFilter, setProjectFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
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

  const filteredColumns = useMemo(() => {
    const matches = (ticket) => {
      if (projectFilter && ticket.project_id !== projectFilter) return false;
      if (categoryFilter && ticket.category !== categoryFilter) return false;
      if (priorityFilter && ticket.priority !== priorityFilter) return false;
      return true;
    };

    return Object.fromEntries(
      STATUS_OPTIONS.map((status) => [status, (columns[status] || []).filter(matches)])
    );
  }, [columns, projectFilter, categoryFilter, priorityFilter]);

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
        <label className="form-group">
          <span className="form-label">{t("tickets.project")}</span>
          <select className="form-select" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
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
          <select className="form-select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
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
          <select className="form-select" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
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
              />
            ))}
          </div>

          <DragOverlay>{activeTicket ? <TicketCard ticket={activeTicket} muted /> : null}</DragOverlay>
        </DndContext>
      ) : null}
    </section>
  );
}
