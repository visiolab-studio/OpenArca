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
import { useTranslation } from "react-i18next";
import { getBoard, patchTicket } from "../api/tickets";
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS, STATUS_OPTIONS } from "../utils/constants";
import PriorityBadge from "../components/PriorityBadge";
import StatusBadge from "../components/StatusBadge";
import { formatDateShort } from "../utils/format";

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

function TicketCard({ ticket, muted = false }) {
  return (
    <article className={`kanban-card${muted ? " muted-card" : ""}`}>
      <div className="kanban-card-header">
        <strong>#{String(ticket.number).padStart(3, "0")}</strong>
        <PriorityBadge priority={ticket.priority} />
      </div>
      <p>{ticket.title}</p>
      <div className="kanban-card-meta">
        <span className="chip">{ticket.project_name || "-"}</span>
        <span className="muted">{formatDateShort(ticket.planned_date)}</span>
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
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TicketCard ticket={ticket} />
    </div>
  );
}

function KanbanColumn({ title, status, tickets, collapsed, onToggle }) {
  const { setNodeRef } = useDroppable({ id: status });

  return (
    <section className="kanban-column">
      <header className="kanban-column-header">
        {onToggle ? (
          <button type="button" className="btn btn-ghost" onClick={onToggle}>
            {title}
          </button>
        ) : (
          <div>{title}</div>
        )}
        <span className="badge">{tickets.length}</span>
      </header>

      {!collapsed ? (
        <SortableContext items={tickets.map((ticket) => ticket.id)} strategy={verticalListSortingStrategy}>
          <div ref={setNodeRef} className="kanban-column-body" id={status}>
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

        const next = Object.fromEntries(
          STATUS_OPTIONS.map((status) => [status, response[status] || []])
        );
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

    const optimistic = {
      ...columns,
      [source]: sourceItems.filter((item) => item.id !== ticket.id),
      [target]: [{ ...ticket, status: target }, ...(columns[target] || [])]
    };

    setColumns(optimistic);

    try {
      await patchTicket(ticket.id, { status: target });
    } catch (patchError) {
      setColumns(columns);
      setError(patchError?.response?.data?.error || patchError.message || "internal_error");
    }
  }

  return (
    <section className="page-content">
      <header className="page-header">
        <h1>{t("nav.board")}</h1>
      </header>

      <article className="card form-grid filters-grid">
        <label>
          {t("tickets.project")}
          <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
            <option value="">-</option>
            {allProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t("tickets.category")}
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="">-</option>
            {CATEGORY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`category.${value}`)}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t("tickets.priority")}
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
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
          <div className="kanban-grid">
            {STATUS_OPTIONS.map((status) => (
              <div key={status} id={status}>
                <KanbanColumn
                  title={
                    <>
                      <StatusBadge status={status} />
                    </>
                  }
                  status={status}
                  tickets={filteredColumns[status] || []}
                  collapsed={status === "closed" ? collapsedClosed : false}
                  onToggle={
                    status === "closed"
                      ? () => setCollapsedClosed((current) => !current)
                      : undefined
                  }
                />
              </div>
            ))}
          </div>

          <DragOverlay>{activeTicket ? <TicketCard ticket={activeTicket} muted /> : null}</DragOverlay>
        </DndContext>
      ) : null}
    </section>
  );
}
