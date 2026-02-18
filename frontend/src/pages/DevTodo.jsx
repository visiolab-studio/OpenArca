import { useEffect, useMemo, useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarDays,
  Check,
  Clock3,
  GripVertical,
  Pencil,
  Play,
  Save,
  Trash2,
  X
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  createDevTask,
  deleteDevTask,
  getDevTasks,
  patchDevTask,
  reorderDevTasks
} from "../api/devTasks";
import { getTickets } from "../api/tickets";
import { PRIORITY_OPTIONS } from "../utils/constants";

const priorityWeight = { critical: 0, high: 1, normal: 2, low: 3 };

function normalizeError(error) {
  return error?.response?.data?.error || error?.message || "internal_error";
}

function SortableTaskItem({ task, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={task.status === "in_progress" ? "todo-item in_progress" : "todo-item"}
    >
      <button type="button" className="todo-drag-handle" {...attributes} {...listeners}>
        <GripVertical size={14} />
      </button>
      {children}
    </article>
  );
}

function dateClass(value) {
  if (!value) return "todo-date";
  const today = new Date().toISOString().slice(0, 10);
  const inThreeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  if (value < today) return "todo-date overdue";
  if (value <= inThreeDays) return "todo-date soon";
  return "todo-date";
}

function TaskRow({
  task,
  draft,
  isEditing,
  onStartEdit,
  onChangeDraft,
  onSave,
  onCancel,
  onStatusChange,
  onDelete,
  t
}) {
  return (
    <>
      <span className="todo-priority-dot" data-priority={draft?.priority || task.priority} />

      <div>
        {isEditing ? (
          <div className="form-grid">
            <input
              className="form-input"
              value={draft.title}
              onChange={(event) => onChangeDraft(task.id, { title: event.target.value })}
            />
            <div className="filters-grid">
              <select
                className="form-select"
                value={draft.priority}
                onChange={(event) => onChangeDraft(task.id, { priority: event.target.value })}
              >
                {PRIORITY_OPTIONS.map((priority) => (
                  <option key={priority} value={priority}>
                    {t(`priority.${priority}`)}
                  </option>
                ))}
              </select>
              <input
                className="form-input"
                type="number"
                step="0.5"
                min="0"
                value={draft.estimated_hours}
                onChange={(event) => onChangeDraft(task.id, { estimated_hours: event.target.value })}
              />
              <input
                className="form-input"
                type="date"
                value={draft.planned_date}
                onChange={(event) => onChangeDraft(task.id, { planned_date: event.target.value })}
              />
            </div>
          </div>
        ) : (
          <div className="todo-item-title">{task.title}</div>
        )}
      </div>

      <div>
        {task.ticket_id ? (
          <Link to={`/ticket/${task.ticket_id}`} className="todo-ticket-link">
            #{task.ticket_id.slice(0, 8)}
          </Link>
        ) : (
          <span className="todo-ticket-link">-</span>
        )}
      </div>

      <div className="todo-time">
        <Clock3 size={12} />
        <span>{task.estimated_hours ?? "-"}h</span>
      </div>

      <div className={dateClass(task.planned_date)}>
        <CalendarDays size={12} />
        <span>{task.planned_date || "-"}</span>
      </div>

      <div className="todo-actions">
        {isEditing ? (
          <>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onSave(task.id)}>
              <Save size={12} />
              <span>{t("app.save")}</span>
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onCancel(task.id)}>
              <X size={12} />
              <span>{t("app.cancel")}</span>
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => onStartEdit(task)}>
            <Pencil size={12} />
            <span>{t("app.save")}</span>
          </button>
        )}

        {task.status === "todo" ? (
          <button type="button" className="todo-status-btn" onClick={() => onStatusChange(task, "in_progress")}>
            <Play size={12} />
            <span>{t("dev.start")}</span>
          </button>
        ) : (
          <button type="button" className="todo-status-btn" onClick={() => onStatusChange(task, "done")}>
            <Check size={12} />
            <span>{t("dev.markDone")}</span>
          </button>
        )}

        <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete(task.id)}>
          <Trash2 size={12} />
          <span>{t("dev.delete")}</span>
        </button>
      </div>
    </>
  );
}

export default function DevTodoPage() {
  const { t } = useTranslation();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const [activeTasks, setActiveTasks] = useState([]);
  const [doneTasks, setDoneTasks] = useState([]);
  const [ticketsMap, setTicketsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "normal",
    estimated_hours: "",
    planned_date: "",
    ticket_id: ""
  });

  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [tasksResponse, ticketsResponse] = await Promise.all([getDevTasks(), getTickets()]);
        if (!active) return;

        const ticketStatusMap = {};
        for (const ticket of ticketsResponse) {
          ticketStatusMap[ticket.id] = ticket;
        }

        setTicketsMap(ticketStatusMap);
        setActiveTasks(tasksResponse.active || []);
        setDoneTasks(tasksResponse.done || []);
      } catch (loadError) {
        setError(normalizeError(loadError));
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  async function persistOrder(nextTasks) {
    const payload = nextTasks.map((task, index) => ({
      id: task.id,
      order_index: index
    }));
    await reorderDevTasks(payload);
  }

  const visibleActiveTasks = useMemo(() => {
    return activeTasks.filter((task) => {
      if (priorityFilter && task.priority !== priorityFilter) return false;
      if (statusFilter && task.status !== statusFilter) return false;
      return true;
    });
  }, [activeTasks, priorityFilter, statusFilter]);

  const summary = useMemo(() => {
    const totalHours = activeTasks.reduce((sum, task) => sum + Number(task.estimated_hours || 0), 0);

    const counts = { critical: 0, high: 0, normal: 0, low: 0 };
    let withoutPlannedDate = 0;
    for (const task of activeTasks) {
      counts[task.priority] = (counts[task.priority] || 0) + 1;
      if (!task.planned_date && task.ticket_id) {
        withoutPlannedDate += 1;
      }
    }

    return {
      totalHours,
      counts,
      withoutPlannedDate
    };
  }, [activeTasks]);

  const canReorder = !priorityFilter && !statusFilter;

  async function handleCreateTask(event) {
    event.preventDefault();
    if (!newTask.title.trim()) {
      setError("validation_error");
      return;
    }

    setError("");

    try {
      const created = await createDevTask({
        title: newTask.title.trim(),
        description: newTask.description.trim() || undefined,
        priority: newTask.priority,
        estimated_hours: newTask.estimated_hours === "" ? undefined : Number(newTask.estimated_hours),
        planned_date: newTask.planned_date || undefined,
        ticket_id: newTask.ticket_id || undefined
      });

      const next = [...activeTasks, created].map((task, index) => ({ ...task, order_index: index }));
      setActiveTasks(next);
      await persistOrder(next);

      setNewTask({
        title: "",
        description: "",
        priority: "normal",
        estimated_hours: "",
        planned_date: "",
        ticket_id: ""
      });
    } catch (createError) {
      setError(normalizeError(createError));
    }
  }

  function startEdit(task) {
    setDrafts((current) => ({
      ...current,
      [task.id]: {
        title: task.title || "",
        priority: task.priority || "normal",
        estimated_hours: task.estimated_hours ?? "",
        planned_date: task.planned_date || ""
      }
    }));
  }

  function cancelEdit(taskId) {
    setDrafts((current) => {
      const next = { ...current };
      delete next[taskId];
      return next;
    });
  }

  function patchDraft(taskId, patch) {
    setDrafts((current) => ({
      ...current,
      [taskId]: {
        ...(current[taskId] || {}),
        ...patch
      }
    }));
  }

  async function saveEdit(taskId) {
    const draft = drafts[taskId];
    if (!draft) return;

    try {
      const updated = await patchDevTask(taskId, {
        title: draft.title,
        priority: draft.priority,
        estimated_hours: draft.estimated_hours === "" ? null : Number(draft.estimated_hours),
        planned_date: draft.planned_date || null
      });

      setActiveTasks((current) => current.map((task) => (task.id === taskId ? updated : task)));
      setDoneTasks((current) => current.map((task) => (task.id === taskId ? updated : task)));
      cancelEdit(taskId);
    } catch (patchError) {
      setError(normalizeError(patchError));
    }
  }

  async function handleStatusChange(task, nextStatus) {
    try {
      const updated = await patchDevTask(task.id, { status: nextStatus });

      if (nextStatus === "done") {
        setActiveTasks((current) => current.filter((item) => item.id !== task.id));
        setDoneTasks((current) => [updated, ...current].slice(0, 20));
      } else {
        setActiveTasks((current) => current.map((item) => (item.id === task.id ? updated : item)));
      }
    } catch (patchError) {
      setError(normalizeError(patchError));
    }
  }

  async function handleDelete(taskId) {
    try {
      await deleteDevTask(taskId);
      setActiveTasks((current) => current.filter((task) => task.id !== taskId));
      setDoneTasks((current) => current.filter((task) => task.id !== taskId));
      cancelEdit(taskId);
    } catch (deleteError) {
      setError(normalizeError(deleteError));
    }
  }

  async function handleDragEnd(event) {
    if (!canReorder) return;

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = activeTasks.findIndex((task) => task.id === active.id);
    const newIndex = activeTasks.findIndex((task) => task.id === over.id);

    if (oldIndex < 0 || newIndex < 0) return;

    const previous = activeTasks;
    const reordered = arrayMove(activeTasks, oldIndex, newIndex).map((task, index) => ({
      ...task,
      order_index: index
    }));

    setActiveTasks(reordered);

    try {
      await persistOrder(reordered);
    } catch (reorderError) {
      setActiveTasks(previous);
      setError(normalizeError(reorderError));
    }
  }

  async function handleAutoSort() {
    const sorted = [...activeTasks].sort((a, b) => {
      const aBlocked = a.ticket_id && ticketsMap[a.ticket_id]?.status === "blocked";
      const bBlocked = b.ticket_id && ticketsMap[b.ticket_id]?.status === "blocked";

      const aPriority = Math.max(0, (priorityWeight[a.priority] ?? 99) - (aBlocked ? 1 : 0));
      const bPriority = Math.max(0, (priorityWeight[b.priority] ?? 99) - (bBlocked ? 1 : 0));

      if (aPriority !== bPriority) return aPriority - bPriority;

      const aHasDate = Boolean(a.planned_date);
      const bHasDate = Boolean(b.planned_date);
      if (aHasDate !== bHasDate) return aHasDate ? -1 : 1;

      if (aHasDate && bHasDate) {
        const dateCompare = String(a.planned_date).localeCompare(String(b.planned_date));
        if (dateCompare !== 0) return dateCompare;
      }

      if (a.status !== b.status) {
        if (a.status === "in_progress") return -1;
        if (b.status === "in_progress") return 1;
      }

      return Number(a.order_index || 0) - Number(b.order_index || 0);
    });

    const normalized = sorted.map((task, index) => ({ ...task, order_index: index }));
    setActiveTasks(normalized);

    try {
      await persistOrder(normalized);
    } catch (reorderError) {
      setError(normalizeError(reorderError));
    }
  }

  return (
    <section className="page-content todo-page">
      {error ? <p className="feedback err">{t(`errors.${error}`, { defaultValue: error })}</p> : null}

      <article className="todo-summary">
        <div className="todo-summary-item">
          <span className="todo-summary-value">{summary.totalHours.toFixed(1)}h</span>
          <span className="todo-summary-label">{t("dev.totalEstimated")}</span>
        </div>
        <div className="todo-summary-item">
          <span className="todo-summary-value">{summary.counts.critical}</span>
          <span className="todo-summary-label">{t("priority.critical")}</span>
        </div>
        <div className="todo-summary-item">
          <span className="todo-summary-value">{summary.counts.high}</span>
          <span className="todo-summary-label">{t("priority.high")}</span>
        </div>
        <div className="todo-summary-item">
          <span className="todo-summary-value">{summary.counts.normal + summary.counts.low}</span>
          <span className="todo-summary-label">{t("dev.active")}</span>
        </div>
      </article>

      {summary.withoutPlannedDate > 0 ? (
        <div className="todo-auto-sort-bar">
          <span>{t("dev.withoutPlanAlert")}: {summary.withoutPlannedDate}</span>
        </div>
      ) : null}

      <article className="card">
        <h2 className="card-title">{t("dev.newTask")}</h2>
        <form className="form-grid" onSubmit={handleCreateTask}>
          <input
            className="form-input"
            type="text"
            placeholder={t("tickets.titleField")}
            value={newTask.title}
            onChange={(event) => setNewTask((current) => ({ ...current, title: event.target.value }))}
          />

          <textarea
            className="form-textarea"
            rows={2}
            placeholder={t("tickets.description")}
            value={newTask.description}
            onChange={(event) =>
              setNewTask((current) => ({ ...current, description: event.target.value }))
            }
          />

          <div className="filters-grid">
            <select
              className="form-select"
              value={newTask.priority}
              onChange={(event) => setNewTask((current) => ({ ...current, priority: event.target.value }))}
            >
              {PRIORITY_OPTIONS.map((priority) => (
                <option key={priority} value={priority}>
                  {t(`priority.${priority}`)}
                </option>
              ))}
            </select>

            <input
              className="form-input"
              type="number"
              step="0.5"
              min="0"
              placeholder={t("tickets.estimatedHours")}
              value={newTask.estimated_hours}
              onChange={(event) =>
                setNewTask((current) => ({ ...current, estimated_hours: event.target.value }))
              }
            />

            <input
              className="form-input"
              type="date"
              value={newTask.planned_date}
              onChange={(event) =>
                setNewTask((current) => ({ ...current, planned_date: event.target.value }))
              }
            />
          </div>

          <input
            className="form-input"
            type="text"
            placeholder={t("dev.linkedTicket")}
            value={newTask.ticket_id}
            onChange={(event) => setNewTask((current) => ({ ...current, ticket_id: event.target.value }))}
          />

          <button className="btn btn-yellow" type="submit">
            {t("dev.create")}
          </button>
        </form>
      </article>

      <article className="card">
        <div className="todo-toolbar">
          <div className="todo-toolbar-left">
            <select className="form-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">{t("tickets.status")}</option>
              <option value="todo">{t("dev.taskTodo")}</option>
              <option value="in_progress">{t("dev.taskInProgress")}</option>
            </select>
            <select className="form-select" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
              <option value="">{t("tickets.priority")}</option>
              {PRIORITY_OPTIONS.map((priority) => (
                <option key={priority} value={priority}>
                  {t(`priority.${priority}`)}
                </option>
              ))}
            </select>
          </div>

          <button type="button" className="btn btn-secondary" onClick={handleAutoSort}>
            {t("dev.applyAutoSort")}
          </button>
        </div>

        {loading ? <p>{t("app.loading")}</p> : null}
        {!loading && visibleActiveTasks.length === 0 ? <p>{t("tickets.noTickets")}</p> : null}

        {!loading && visibleActiveTasks.length > 0 ? (
          <div className="todo-list">
            {canReorder ? (
              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <SortableContext
                  items={visibleActiveTasks.map((task) => task.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {visibleActiveTasks.map((task) => (
                    <SortableTaskItem key={task.id} task={task}>
                      <TaskRow
                        task={task}
                        draft={drafts[task.id]}
                        isEditing={Boolean(drafts[task.id])}
                        onStartEdit={startEdit}
                        onChangeDraft={patchDraft}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDelete}
                        t={t}
                      />
                    </SortableTaskItem>
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              <>
                {visibleActiveTasks.map((task) => (
                  <article
                    key={task.id}
                    className={task.status === "in_progress" ? "todo-item in_progress" : "todo-item"}
                  >
                    <span className="todo-drag-handle">
                      <GripVertical size={14} />
                    </span>
                    <TaskRow
                      task={task}
                      draft={drafts[task.id]}
                      isEditing={Boolean(drafts[task.id])}
                      onStartEdit={startEdit}
                      onChangeDraft={patchDraft}
                      onSave={saveEdit}
                      onCancel={cancelEdit}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDelete}
                      t={t}
                    />
                  </article>
                ))}
              </>
            )}
          </div>
        ) : null}
      </article>

      <article className="card">
        <h2 className="card-title">{t("dev.done")}</h2>
        {doneTasks.length === 0 ? <p>{t("tickets.noTickets")}</p> : null}
        {doneTasks.length > 0 ? (
          <div className="todo-list">
            {doneTasks.map((task) => (
              <article key={task.id} className="todo-item todo-item-done">
                <span className="todo-priority-dot" data-priority={task.priority} />
                <div className="todo-item-title">{task.title}</div>
                <div className="todo-date">{task.planned_date || "-"}</div>
                <div className="todo-date">{task.updated_at?.slice(0, 10) || "-"}</div>
              </article>
            ))}
          </div>
        ) : null}
      </article>
    </section>
  );
}
