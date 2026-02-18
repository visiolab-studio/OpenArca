import { useEffect, useMemo, useState } from "react";
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
import { CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getBoard, patchTicket } from "../api/tickets";
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS, STATUS_OPTIONS } from "../utils/constants";
import PriorityBadge from "../components/PriorityBadge";

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

function TicketCard({ ticket, muted = false }) {
  return (
    <article
      className={`kanban-card${muted ? " dragging" : ""}`}
      data-priority={ticket.priority || "normal"}
    >
      <div className="kanban-card-number">#{String(ticket.number).padStart(3, "0")}</div>
      <p className="kanban-card-title">{ticket.title}</p>
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

function SortableTicketCard({ ticket }) {
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
      <TicketCard ticket={ticket} />
    </div>
  );
}

function KanbanColumn({ title, status, tickets, collapsed, onToggle }) {
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
              <SortableTicketCard key={ticket.id} ticket={ticket} />
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

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await getBoard();
        if (!active) return;

        const next = Object.fromEntries(STATUS_OPTIONS.map((status) => [status, response[status] || []]));
        setColumns(next);
      } catch (loadError) {
        setError(loadError?.response?.data?.error || loadError.message || "internal_error");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

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
              />
            ))}
          </div>

          <DragOverlay>{activeTicket ? <TicketCard ticket={activeTicket} muted /> : null}</DragOverlay>
        </DndContext>
      ) : null}
    </section>
  );
}
