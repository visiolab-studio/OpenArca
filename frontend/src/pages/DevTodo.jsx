import { useEffect, useMemo, useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
import PriorityBadge from "../components/PriorityBadge";
import { PRIORITY_OPTIONS } from "../utils/constants";
import { formatDateShort } from "../utils/format";

const priorityWeight = { critical: 0, high: 1, normal: 2, low: 3 };

function SortableRow({ task, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <tr ref={setNodeRef} style={style}>
      <td>
        <button type="button" className="btn btn-ghost" {...attributes} {...listeners}>
          ↕
        </button>
      </td>
      {children}
    </tr>
  );
}

function normalizeError(error) {
  return error?.response?.data?.error || error?.message || "internal_error";
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
    const totalHours = activeTasks.reduce(
      (sum, task) => sum + Number(task.estimated_hours || 0),
      0
    );

    const counts = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0
    };

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
        estimated_hours:
          newTask.estimated_hours === "" ? undefined : Number(newTask.estimated_hours),
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
        description: task.description || "",
        priority: task.priority || "normal",
        estimated_hours: task.estimated_hours ?? "",
        planned_date: task.planned_date || ""
      }
    }));
  }

  async function saveEdit(taskId) {
    const draft = drafts[taskId];
    if (!draft) return;

    try {
      const updated = await patchDevTask(taskId, {
        title: draft.title,
        description: draft.description || null,
        priority: draft.priority,
        estimated_hours: draft.estimated_hours === "" ? null : Number(draft.estimated_hours),
        planned_date: draft.planned_date || null
      });

      setActiveTasks((current) => current.map((task) => (task.id === taskId ? updated : task)));
      setDoneTasks((current) => current.map((task) => (task.id === taskId ? updated : task)));
      setDrafts((current) => {
        const next = { ...current };
        delete next[taskId];
        return next;
      });
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
    } catch (deleteError) {
      setError(normalizeError(deleteError));
    }
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = activeTasks.findIndex((task) => task.id === active.id);
    const newIndex = activeTasks.findIndex((task) => task.id === over.id);

    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(activeTasks, oldIndex, newIndex).map((task, index) => ({
      ...task,
      order_index: index
    }));

    setActiveTasks(reordered);

    try {
      await persistOrder(reordered);
    } catch (reorderError) {
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
    <section className="page-content">
      <header className="page-header">
        <h1>{t("nav.todo")}</h1>
      </header>

      {error ? <p className="feedback err">{t(`errors.${error}`, { defaultValue: error })}</p> : null}

      <article className="card panel-grid">
        <div>
          <h2>{t("dev.summary")}</h2>
          <p>{t("dev.totalEstimated")}: {summary.totalHours.toFixed(1)}</p>
          <p>
            {t("priority.critical")}: {summary.counts.critical} · {t("priority.high")}: {summary.counts.high} · {t("priority.normal")}: {summary.counts.normal} · {t("priority.low")}: {summary.counts.low}
          </p>
          {summary.withoutPlannedDate > 0 ? (
            <p className="feedback err">{t("dev.withoutPlanAlert")}: {summary.withoutPlannedDate}</p>
          ) : null}
        </div>

        <form className="form-grid" onSubmit={handleCreateTask}>
          <h2>{t("dev.newTask")}</h2>
          <label>
            {t("tickets.titleField")}
            <input
              type="text"
              value={newTask.title}
              onChange={(event) => setNewTask((current) => ({ ...current, title: event.target.value }))}
            />
          </label>

          <label>
            {t("tickets.description")}
            <textarea
              rows={2}
              value={newTask.description}
              onChange={(event) => setNewTask((current) => ({ ...current, description: event.target.value }))}
            />
          </label>

          <div className="filters-grid">
            <label>
              {t("tickets.priority")}
              <select
                value={newTask.priority}
                onChange={(event) => setNewTask((current) => ({ ...current, priority: event.target.value }))}
              >
                {PRIORITY_OPTIONS.map((priority) => (
                  <option key={priority} value={priority}>
                    {t(`priority.${priority}`)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {t("tickets.estimatedHours")}
              <input
                type="number"
                step="0.5"
                min="0"
                value={newTask.estimated_hours}
                onChange={(event) =>
                  setNewTask((current) => ({ ...current, estimated_hours: event.target.value }))
                }
              />
            </label>

            <label>
              {t("tickets.plannedDate")}
              <input
                type="date"
                value={newTask.planned_date}
                onChange={(event) =>
                  setNewTask((current) => ({ ...current, planned_date: event.target.value }))
                }
              />
            </label>
          </div>

          <label>
            {t("dev.linkedTicket")}
            <input
              type="text"
              value={newTask.ticket_id}
              onChange={(event) => setNewTask((current) => ({ ...current, ticket_id: event.target.value }))}
            />
          </label>

          <button className="btn" type="submit">{t("dev.create")}</button>
        </form>
      </article>

      <article className="card form-grid filters-grid">
        <label>
          {t("tickets.status")}
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">-</option>
            <option value="todo">{t("dev.taskTodo")}</option>
            <option value="in_progress">{t("dev.taskInProgress")}</option>
          </select>
        </label>

        <label>
          {t("tickets.priority")}
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
            <option value="">-</option>
            {PRIORITY_OPTIONS.map((priority) => (
              <option key={priority} value={priority}>
                {t(`priority.${priority}`)}
              </option>
            ))}
          </select>
        </label>

        <div className="row-actions">
          <button type="button" className="btn" onClick={handleAutoSort}>
            {t("dev.applyAutoSort")}
          </button>
        </div>
      </article>

      <article className="card table-wrap">
        <h2>{t("dev.active")}</h2>
        {loading ? <p>{t("app.loading")}</p> : null}
        {!loading && visibleActiveTasks.length === 0 ? <p>{t("tickets.noTickets")}</p> : null}

        {!loading && visibleActiveTasks.length > 0 ? (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>{t("tickets.priority")}</th>
                  <th>{t("tickets.titleField")}</th>
                  <th>{t("dev.linkedTicket")}</th>
                  <th>{t("tickets.estimatedHours")}</th>
                  <th>{t("tickets.plannedDate")}</th>
                  <th>{t("tickets.status")}</th>
                  <th>{t("admin.action")}</th>
                </tr>
              </thead>
              <tbody>
                <SortableContext
                  items={visibleActiveTasks.map((task) => task.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {visibleActiveTasks.map((task) => {
                    const draft = drafts[task.id];
                    return (
                      <SortableRow key={task.id} task={task}>
                        <td>
                          <PriorityBadge priority={task.priority} />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={draft ? draft.title : task.title}
                            onFocus={() => startEdit(task)}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [task.id]: {
                                  ...(current[task.id] || {
                                    title: task.title,
                                    description: task.description || "",
                                    priority: task.priority,
                                    estimated_hours: task.estimated_hours ?? "",
                                    planned_date: task.planned_date || ""
                                  }),
                                  title: event.target.value
                                }
                              }))
                            }
                          />
                          <textarea
                            rows={2}
                            value={draft ? draft.description : task.description || ""}
                            onFocus={() => startEdit(task)}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [task.id]: {
                                  ...(current[task.id] || {
                                    title: task.title,
                                    description: task.description || "",
                                    priority: task.priority,
                                    estimated_hours: task.estimated_hours ?? "",
                                    planned_date: task.planned_date || ""
                                  }),
                                  description: event.target.value
                                }
                              }))
                            }
                          />
                        </td>
                        <td>
                          {task.ticket_id ? (
                            <Link to={`/ticket/${task.ticket_id}`} className="btn btn-ghost">
                              {task.ticket_id.slice(0, 8)}...
                            </Link>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={draft ? draft.estimated_hours : task.estimated_hours ?? ""}
                            onFocus={() => startEdit(task)}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [task.id]: {
                                  ...(current[task.id] || {
                                    title: task.title,
                                    description: task.description || "",
                                    priority: task.priority,
                                    estimated_hours: task.estimated_hours ?? "",
                                    planned_date: task.planned_date || ""
                                  }),
                                  estimated_hours: event.target.value
                                }
                              }))
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            value={draft ? draft.planned_date : task.planned_date || ""}
                            onFocus={() => startEdit(task)}
                            onChange={(event) =>
                              setDrafts((current) => ({
                                ...current,
                                [task.id]: {
                                  ...(current[task.id] || {
                                    title: task.title,
                                    description: task.description || "",
                                    priority: task.priority,
                                    estimated_hours: task.estimated_hours ?? "",
                                    planned_date: task.planned_date || ""
                                  }),
                                  planned_date: event.target.value
                                }
                              }))
                            }
                          />
                        </td>
                        <td>
                          <span className="badge">
                            {task.status === "todo" ? t("dev.taskTodo") : t("dev.taskInProgress")}
                          </span>
                          <div>
                            <select
                              value={draft ? draft.priority : task.priority}
                              onFocus={() => startEdit(task)}
                              onChange={(event) =>
                                setDrafts((current) => ({
                                  ...current,
                                  [task.id]: {
                                    ...(current[task.id] || {
                                      title: task.title,
                                      description: task.description || "",
                                      priority: task.priority,
                                      estimated_hours: task.estimated_hours ?? "",
                                      planned_date: task.planned_date || ""
                                    }),
                                    priority: event.target.value
                                  }
                                }))
                              }
                            >
                              {PRIORITY_OPTIONS.map((priority) => (
                                <option key={priority} value={priority}>
                                  {priority}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td>
                          <div className="row-actions">
                            {draft ? (
                              <button type="button" className="btn btn-ghost" onClick={() => saveEdit(task.id)}>
                                {t("app.save")}
                              </button>
                            ) : null}
                            {task.status === "todo" ? (
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => handleStatusChange(task, "in_progress")}
                              >
                                {t("dev.start")}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => handleStatusChange(task, "done")}
                              >
                                {t("dev.markDone")}
                              </button>
                            )}
                            <button type="button" className="btn btn-ghost" onClick={() => handleDelete(task.id)}>
                              {t("dev.delete")}
                            </button>
                          </div>
                        </td>
                      </SortableRow>
                    );
                  })}
                </SortableContext>
              </tbody>
            </table>
          </DndContext>
        ) : null}
      </article>

      <article className="card table-wrap">
        <h2>{t("dev.done")}</h2>
        {doneTasks.length === 0 ? <p>{t("tickets.noTickets")}</p> : null}
        {doneTasks.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>{t("tickets.priority")}</th>
                <th>{t("tickets.titleField")}</th>
                <th>{t("tickets.plannedDate")}</th>
                <th>{t("tickets.updatedAt")}</th>
              </tr>
            </thead>
            <tbody>
              {doneTasks.map((task) => (
                <tr key={task.id}>
                  <td><PriorityBadge priority={task.priority} /></td>
                  <td>{task.title}</td>
                  <td>{formatDateShort(task.planned_date)}</td>
                  <td>{formatDateShort(task.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </article>
    </section>
  );
}
