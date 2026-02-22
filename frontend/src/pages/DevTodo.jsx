import { useCallback, useEffect, useMemo, useState } from "react";
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
  Plus,
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
import { addComment, getTickets, patchTicket } from "../api/tickets";
import PriorityBadge from "../components/PriorityBadge";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../contexts/AuthContext";
import { PRIORITY_OPTIONS } from "../utils/constants";

const priorityWeight = { critical: 0, high: 1, normal: 2, low: 3 };

function normalizeError(error) {
  return error?.response?.data?.error || error?.message || "internal_error";
}

function toPreviewDraft(task) {
  return {
    title: task.title || "",
    description: task.description || "",
    priority: task.priority || "normal",
    estimated_hours: task.estimated_hours ?? "",
    planned_date: task.planned_date || ""
  };
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
  ticket,
  currentUserId,
  draft,
  isEditing,
  onOpenPreview,
  onStartEdit,
  onChangeDraft,
  onSave,
  onCancel,
  onStatusChange,
  onDelete,
  t
}) {
  const ticketRef = task.ticket_id
    ? (ticket?.number ? `#${String(ticket.number).padStart(3, "0")}` : `#${task.ticket_id.slice(0, 8)}`)
    : "-";

  let ticketAssignmentLabel = t("dev.taskNoTicket");
  let ticketAssignmentClass = "todo-assignee-none";

  if (task.ticket_id) {
    if (!ticket) {
      ticketAssignmentLabel = t("dev.ticketAssignmentUnknown");
      ticketAssignmentClass = "todo-assignee-unknown";
    } else if (!ticket.assignee_id) {
      ticketAssignmentLabel = t("dev.ticketUnassigned");
      ticketAssignmentClass = "todo-assignee-unassigned";
    } else if (ticket.assignee_id === currentUserId) {
      ticketAssignmentLabel = t("dev.ticketAssignedMe");
      ticketAssignmentClass = "todo-assignee-assigned";
    } else {
      ticketAssignmentLabel = t("dev.ticketAssignedOther");
      ticketAssignmentClass = "todo-assignee-other";
    }
  }

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
          <>
            <button type="button" className="todo-title-btn" onClick={() => onOpenPreview(task)}>
              <div className="todo-item-title">
                {task.status === "in_progress" ? (
                  <span
                    className="todo-in-progress-indicator"
                    aria-label={t("dev.taskInProgress")}
                    title={t("dev.taskInProgress")}
                  >
                    <Play size={10} />
                  </span>
                ) : null}
                <span>{task.title}</span>
              </div>
            </button>
            <div className="todo-item-meta-line">
              {task.ticket_id ? (
                <Link to={`/ticket/${task.ticket_id}`} className="todo-ticket-link">
                  {ticketRef}
                </Link>
              ) : (
                <span className="todo-ticket-link">-</span>
              )}
              <span className={`todo-assignee-pill ${ticketAssignmentClass}`}>
                {ticketAssignmentLabel}
              </span>
            </div>
          </>
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
  const { user } = useAuth();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const [activeTasks, setActiveTasks] = useState([]);
  const [doneTasks, setDoneTasks] = useState([]);
  const [submittedTickets, setSubmittedTickets] = useState([]);
  const [ticketsMap, setTicketsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ticketActionId, setTicketActionId] = useState("");

  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [completeTask, setCompleteTask] = useState(null);
  const [completionComment, setCompletionComment] = useState("");
  const [completionError, setCompletionError] = useState("");
  const [completionBusy, setCompletionBusy] = useState("");
  const [previewTaskId, setPreviewTaskId] = useState("");
  const [previewDraft, setPreviewDraft] = useState(null);
  const [previewBusy, setPreviewBusy] = useState("");

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "normal",
    estimated_hours: "",
    planned_date: "",
    ticket_id: ""
  });

  const [drafts, setDrafts] = useState({});

  const applyLoadedData = useCallback((tasksResponse, ticketsResponse) => {
    const ticketStatusMap = {};
    for (const ticket of ticketsResponse) {
      ticketStatusMap[ticket.id] = ticket;
    }

    const submitted = ticketsResponse
      .filter((ticket) => ticket.status === "submitted")
      .sort((a, b) => {
        const priorityDiff = (priorityWeight[a.priority] ?? 99) - (priorityWeight[b.priority] ?? 99);
        if (priorityDiff !== 0) return priorityDiff;
        return String(b.created_at || "").localeCompare(String(a.created_at || ""));
      });

    setTicketsMap(ticketStatusMap);
    setSubmittedTickets(submitted);
    setActiveTasks(tasksResponse.active || []);
    setDoneTasks(tasksResponse.done || []);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!user?.id) {
        if (active) setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const [tasksResponse, ticketsResponse] = await Promise.all([getDevTasks(), getTickets()]);
        if (!active) return;
        applyLoadedData(tasksResponse, ticketsResponse);
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
  }, [applyLoadedData, user?.id]);

  const linkedTicketIds = useMemo(
    () =>
      new Set(
        [...activeTasks, ...doneTasks]
          .map((task) => task.ticket_id)
          .filter(Boolean)
      ),
    [activeTasks, doneTasks]
  );

  const linkableTickets = useMemo(() => {
    const statusWeight = {
      in_progress: 0,
      verified: 1,
      waiting: 2,
      blocked: 3,
      submitted: 4,
      closed: 9
    };

    return Object.values(ticketsMap)
      .filter((ticket) => {
        if (ticket.status === "closed" || ticket.status === "submitted") return false;
        if (linkedTicketIds.has(ticket.id)) return false;
        return !ticket.assignee_id || ticket.assignee_id === user?.id;
      })
      .sort((a, b) => {
      const statusDiff = (statusWeight[a.status] ?? 99) - (statusWeight[b.status] ?? 99);
      if (statusDiff !== 0) return statusDiff;

      const priorityDiff = (priorityWeight[a.priority] ?? 99) - (priorityWeight[b.priority] ?? 99);
      if (priorityDiff !== 0) return priorityDiff;

      const aDate = String(a.planned_date || "");
      const bDate = String(b.planned_date || "");
      const dateDiff = aDate.localeCompare(bDate);
      if (dateDiff !== 0) return dateDiff;

      return String(a.updated_at || "").localeCompare(String(b.updated_at || "")) * -1;
    });
  }, [linkedTicketIds, ticketsMap, user?.id]);

  async function persistOrder(nextTasks) {
    if (!Array.isArray(nextTasks) || nextTasks.length === 0) {
      return;
    }
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

  const hasActiveFilters = Boolean(statusFilter || priorityFilter);

  const queuedTickets = useMemo(() => {
    return Object.values(ticketsMap)
      .filter((ticket) => {
        if (ticket.status !== "verified" && ticket.status !== "waiting") return false;
        if (ticket.assignee_id) return false;
        if (linkedTicketIds.has(ticket.id)) return false;
        return true;
      })
      .sort((a, b) => {
        const priorityDiff = (priorityWeight[a.priority] ?? 99) - (priorityWeight[b.priority] ?? 99);
        if (priorityDiff !== 0) return priorityDiff;

        const aDate = String(a.planned_date || "");
        const bDate = String(b.planned_date || "");
        const dateDiff = aDate.localeCompare(bDate);
        if (dateDiff !== 0) return dateDiff;

        return String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
      });
  }, [linkedTicketIds, ticketsMap]);

  const visibleQueueTickets = useMemo(() => {
    return queuedTickets.filter((ticket) => {
      if (priorityFilter && ticket.priority !== priorityFilter) return false;
      if (statusFilter === "in_progress") return false;
      return true;
    });
  }, [queuedTickets, priorityFilter, statusFilter]);

  const summary = useMemo(() => {
    const sourceTasks = hasActiveFilters ? visibleActiveTasks : activeTasks;
    const sourceQueueTickets = hasActiveFilters ? visibleQueueTickets : queuedTickets;
    const totalHours = sourceTasks.reduce((sum, task) => sum + Number(task.estimated_hours || 0), 0);

    const counts = { critical: 0, high: 0, normal: 0, low: 0 };
    const statusCounts = { todo: 0, in_progress: 0 };
    let assignedCount = 0;
    let unassignedCount = 0;
    let withoutPlannedDate = 0;

    for (const task of sourceTasks) {
      counts[task.priority] = (counts[task.priority] || 0) + 1;
      statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;

      const taskTicket = task.ticket_id ? ticketsMap[task.ticket_id] : null;
      if (taskTicket) {
        if (taskTicket.assignee_id === user?.id) {
          assignedCount += 1;
        } else if (!taskTicket.assignee_id) {
          unassignedCount += 1;
        }
      }

      if (!task.planned_date && task.ticket_id) {
        withoutPlannedDate += 1;
      }
    }

    for (const ticket of sourceQueueTickets) {
      counts[ticket.priority] = (counts[ticket.priority] || 0) + 1;

      if (ticket.status === "in_progress") {
        statusCounts.in_progress += 1;
      } else {
        statusCounts.todo += 1;
      }

      if (ticket.assignee_id === user?.id) {
        assignedCount += 1;
      } else if (!ticket.assignee_id) {
        unassignedCount += 1;
      }

      if (!ticket.planned_date) {
        withoutPlannedDate += 1;
      }
    }

    return {
      totalHours,
      counts,
      statusCounts,
      linkedAssigned: assignedCount,
      linkedUnassigned: unassignedCount,
      totalTasks: sourceTasks.length + sourceQueueTickets.length,
      totalTasksAll: activeTasks.length + queuedTickets.length,
      withoutPlannedDate
    };
  }, [activeTasks, hasActiveFilters, queuedTickets, ticketsMap, user?.id, visibleActiveTasks, visibleQueueTickets]);

  const canReorder = !priorityFilter && !statusFilter;
  const allTasks = useMemo(() => [...activeTasks, ...doneTasks], [activeTasks, doneTasks]);
  const previewTask = useMemo(
    () => allTasks.find((task) => task.id === previewTaskId) || null,
    [allTasks, previewTaskId]
  );

  useEffect(() => {
    if (!showCreateModal && !completeTask && !previewTaskId) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape") {
        if (showCreateModal) {
          setShowCreateModal(false);
          return;
        }
        if (completeTask && !completionBusy) {
          setCompleteTask(null);
          setCompletionComment("");
          setCompletionError("");
          return;
        }
        if (previewTaskId && !previewBusy) {
          setPreviewTaskId("");
          setPreviewDraft(null);
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showCreateModal, completeTask, completionBusy, previewTaskId, previewBusy]);

  useEffect(() => {
    if (!previewTaskId) return;
    const exists = allTasks.some((task) => task.id === previewTaskId);
    if (!exists) {
      setPreviewTaskId("");
      setPreviewDraft(null);
    }
  }, [allTasks, previewTaskId]);

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
      setShowCreateModal(false);
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
    if (nextStatus === "done") {
      setCompleteTask(task);
      setCompletionComment("");
      setCompletionError("");
      return;
    }

    try {
      setError("");

      if (nextStatus === "in_progress" && task.ticket_id) {
        const linkedTicket = ticketsMap[task.ticket_id];
        if (linkedTicket && linkedTicket.status !== "in_progress" && linkedTicket.status !== "closed") {
          const ticketPayload = { status: "in_progress" };
          if (!linkedTicket.assignee_id && user?.id) {
            ticketPayload.assignee_id = user.id;
          }
          await patchTicket(task.ticket_id, ticketPayload);
        }
      }

      await patchDevTask(task.id, { status: nextStatus });
      const [tasksResponse, ticketsResponse] = await Promise.all([getDevTasks(), getTickets()]);
      applyLoadedData(tasksResponse, ticketsResponse);
    } catch (patchError) {
      setError(normalizeError(patchError));
    }
  }

  async function handleCompleteTask(mode) {
    if (!completeTask) return;
    const comment = completionComment.trim();
    if (comment.length < 5) {
      setCompletionError("completion_comment_required");
      return;
    }

    try {
      setCompletionBusy(mode);
      setCompletionError("");
      setError("");

      if (completeTask.ticket_id) {
        const summaryHeader = t("dev.completionCommentHeader", { title: completeTask.title });
        await addComment(completeTask.ticket_id, {
          content: `${summaryHeader}\n\n${comment}`,
          is_closure_summary: true
        });
        await patchTicket(completeTask.ticket_id, {
          status: mode === "close" ? "closed" : "waiting"
        });
      }

      const standaloneSummary = t("dev.completionStandaloneHeader");
      const dateLabel = new Date().toISOString().slice(0, 10);
      const nextDescription = completeTask.ticket_id
        ? completeTask.description || null
        : `${completeTask.description ? `${completeTask.description}\n\n` : ""}${standaloneSummary} ${dateLabel}: ${comment}`.slice(0, 4000);

      await patchDevTask(completeTask.id, {
        description: nextDescription,
        status: "done"
      });

      const [tasksResponse, ticketsResponse] = await Promise.all([getDevTasks(), getTickets()]);
      applyLoadedData(tasksResponse, ticketsResponse);

      setCompleteTask(null);
      setCompletionComment("");
      setCompletionError("");
    } catch (completeError) {
      setError(normalizeError(completeError));
    } finally {
      setCompletionBusy("");
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
    if (activeTasks.length < 2) {
      return;
    }

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

  async function handleAcceptTicket(ticket, startNow = false) {
    try {
      setTicketActionId(ticket.id);
      setError("");

      await patchTicket(ticket.id, { status: startNow ? "in_progress" : "verified" });

      const [tasksResponse, ticketsResponse] = await Promise.all([getDevTasks(), getTickets()]);
      applyLoadedData(tasksResponse, ticketsResponse);
    } catch (acceptError) {
      setError(normalizeError(acceptError));
    } finally {
      setTicketActionId("");
    }
  }

  async function handleClaimTicket(ticket, startNow = false) {
    if (!user?.id) return;
    try {
      setTicketActionId(ticket.id);
      setError("");

      await patchTicket(ticket.id, startNow
        ? { assignee_id: user.id, status: "in_progress" }
        : { assignee_id: user.id }
      );

      const [tasksResponse, ticketsResponse] = await Promise.all([getDevTasks(), getTickets()]);
      applyLoadedData(tasksResponse, ticketsResponse);
    } catch (claimError) {
      setError(normalizeError(claimError));
    } finally {
      setTicketActionId("");
    }
  }

  function openTaskPreview(task) {
    setPreviewTaskId(task.id);
    setPreviewDraft(toPreviewDraft(task));
  }

  function closeTaskPreview() {
    if (previewBusy) return;
    setPreviewTaskId("");
    setPreviewDraft(null);
  }

  function patchPreviewDraft(patch) {
    setPreviewDraft((current) => ({
      ...(current || {}),
      ...patch
    }));
  }

  async function saveTaskPreview() {
    if (!previewTask || !previewDraft) return;
    const title = String(previewDraft.title || "").trim();
    if (!title) {
      setError("validation_error");
      return;
    }

    try {
      setPreviewBusy("save");
      setError("");

      await patchDevTask(previewTask.id, {
        title,
        description: String(previewDraft.description || "").trim() || null,
        priority: previewDraft.priority,
        estimated_hours: previewDraft.estimated_hours === "" ? null : Number(previewDraft.estimated_hours),
        planned_date: previewDraft.planned_date || null
      });

      const [tasksResponse, ticketsResponse] = await Promise.all([getDevTasks(), getTickets()]);
      applyLoadedData(tasksResponse, ticketsResponse);
      const refreshed = [...(tasksResponse.active || []), ...(tasksResponse.done || [])].find(
        (task) => task.id === previewTask.id
      );
      if (refreshed) {
        setPreviewDraft(toPreviewDraft(refreshed));
      }
    } catch (previewError) {
      setError(normalizeError(previewError));
    } finally {
      setPreviewBusy("");
    }
  }

  async function handlePreviewStart() {
    if (!previewTask) return;
    try {
      setPreviewBusy("start");
      await handleStatusChange(previewTask, "in_progress");
    } finally {
      setPreviewBusy("");
    }
  }

  function handlePreviewComplete() {
    if (!previewTask) return;
    closeTaskPreview();
    handleStatusChange(previewTask, "done");
  }

  const completeTaskTicket = completeTask?.ticket_id ? ticketsMap[completeTask.ticket_id] : null;
  const completeTaskTicketRef = completeTask?.ticket_id
    ? completeTaskTicket?.number
      ? `#${String(completeTaskTicket.number).padStart(3, "0")}`
      : `#${completeTask.ticket_id.slice(0, 8)}`
    : "";
  const previewTaskTicket = previewTask?.ticket_id ? ticketsMap[previewTask.ticket_id] : null;
  const previewTaskTicketRef = previewTask?.ticket_id
    ? previewTaskTicket?.number
      ? `#${String(previewTaskTicket.number).padStart(3, "0")}`
      : `#${previewTask.ticket_id.slice(0, 8)}`
    : "";

  return (
    <section className="page-content todo-page">
      {error ? <p className="feedback err">{t(`errors.${error}`, { defaultValue: error })}</p> : null}

      <section className="todo-summary-row">
        <article className="todo-summary">
          <div className="todo-summary-item">
            <span className="todo-summary-value">{summary.totalHours.toFixed(1)}h</span>
            <span className="todo-summary-label">{t("dev.totalEstimated")}</span>
          </div>
          <div className="todo-summary-item">
            <span className="todo-summary-value">{summary.totalTasks}</span>
            <span className="todo-summary-label">
              {hasActiveFilters ? t("dev.filteredActive") : t("dev.active")}
            </span>
          </div>
          <div className="todo-summary-item">
            <span className="todo-summary-value">{summary.statusCounts.in_progress}</span>
            <span className="todo-summary-label">{t("dev.taskInProgress")}</span>
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
            <span className="todo-summary-value">{summary.linkedAssigned}</span>
            <span className="todo-summary-label">{t("dev.ticketAssignedMe")}</span>
          </div>
          <div className="todo-summary-item">
            <span className="todo-summary-value">{summary.linkedUnassigned}</span>
            <span className="todo-summary-label">{t("dev.ticketUnassigned")}</span>
          </div>
        </article>
        <button
          type="button"
          className="btn btn-yellow todo-create-open-btn"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={14} />
          <span>{t("dev.newTask")}</span>
        </button>
      </section>

      {summary.withoutPlannedDate > 0 ? (
        <div className="todo-auto-sort-bar">
          <span>{t("dev.withoutPlanAlert")}: {summary.withoutPlannedDate}</span>
        </div>
      ) : null}

      {showCreateModal ? (
        <div className="todo-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <article className="card todo-create-modal" onClick={(event) => event.stopPropagation()}>
            <div className="todo-create-modal-header">
              <h2 className="card-title">{t("dev.newTask")}</h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowCreateModal(false)}
              >
                <X size={12} />
                <span>{t("app.cancel")}</span>
              </button>
            </div>

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

              <label className="form-group">
                <span className="form-label">{t("dev.linkedTicket")}</span>
                <select
                  className="form-select"
                  value={newTask.ticket_id}
                  onChange={(event) =>
                    setNewTask((current) => ({ ...current, ticket_id: event.target.value }))
                  }
                >
                  <option value="">{t("tickets.unassigned")}</option>
                  {linkableTickets.map((ticket) => (
                    <option key={ticket.id} value={ticket.id}>
                      #{String(ticket.number).padStart(3, "0")} · {ticket.title}
                    </option>
                  ))}
                </select>
              </label>

              <div className="todo-create-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  {t("app.cancel")}
                </button>
                <button className="btn btn-yellow" type="submit">
                  {t("dev.create")}
                </button>
              </div>
            </form>
          </article>
        </div>
      ) : null}

      {previewTask && previewDraft ? (
        <div className="todo-modal-backdrop" onClick={closeTaskPreview}>
          <article className="card todo-create-modal todo-preview-modal" onClick={(event) => event.stopPropagation()}>
            <div className="todo-create-modal-header">
              <h2 className="card-title">{t("dev.previewTaskModalTitle")}</h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={closeTaskPreview}
                disabled={Boolean(previewBusy)}
              >
                <X size={12} />
                <span>{t("app.cancel")}</span>
              </button>
            </div>

            <div className="form-grid">
              <div className="row-actions">
                <StatusBadge status={previewTask.status} />
                <PriorityBadge priority={previewTask.priority} />
                {previewTask.ticket_id ? (
                  <Link to={`/ticket/${previewTask.ticket_id}`} className="todo-ticket-link">
                    {previewTaskTicketRef}
                  </Link>
                ) : (
                  <span className="todo-ticket-link">-</span>
                )}
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

              <label className="form-group">
                <span className="form-label">{t("tickets.description")}</span>
                <textarea
                  className="form-textarea"
                  rows={5}
                  value={previewDraft.description}
                  onChange={(event) => patchPreviewDraft({ description: event.target.value })}
                  placeholder={t("dev.previewNoDescription")}
                />
              </label>

              <div className="filters-grid">
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
                <input
                  className="form-input"
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder={t("tickets.estimatedHours")}
                  value={previewDraft.estimated_hours}
                  onChange={(event) => patchPreviewDraft({ estimated_hours: event.target.value })}
                />
                <input
                  className="form-input"
                  type="date"
                  value={previewDraft.planned_date}
                  onChange={(event) => patchPreviewDraft({ planned_date: event.target.value })}
                />
              </div>

              <div className="todo-preview-actions">
                {previewTask.ticket_id ? (
                  <Link to={`/ticket/${previewTask.ticket_id}`} className="btn btn-secondary">
                    {t("dev.openTicket")}
                  </Link>
                ) : null}

                {previewTask.status === "todo" ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handlePreviewStart}
                    disabled={Boolean(previewBusy)}
                  >
                    <Play size={12} />
                    <span>{previewBusy === "start" ? t("app.loading") : t("dev.start")}</span>
                  </button>
                ) : null}

                {previewTask.status === "in_progress" ? (
                  <button
                    type="button"
                    className="btn btn-yellow"
                    onClick={handlePreviewComplete}
                    disabled={Boolean(previewBusy)}
                  >
                    <Check size={12} />
                    <span>{t("dev.markDone")}</span>
                  </button>
                ) : null}
              </div>

              <div className="todo-create-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeTaskPreview} disabled={Boolean(previewBusy)}>
                  {t("app.cancel")}
                </button>
                <button type="button" className="btn btn-yellow" onClick={saveTaskPreview} disabled={Boolean(previewBusy)}>
                  {previewBusy === "save" ? t("app.loading") : t("app.save")}
                </button>
              </div>
            </div>
          </article>
        </div>
      ) : null}

      {completeTask ? (
        <div
          className="todo-modal-backdrop"
          onClick={() => {
            if (completionBusy) return;
            setCompleteTask(null);
            setCompletionComment("");
            setCompletionError("");
          }}
        >
          <article className="card todo-create-modal todo-complete-modal" onClick={(event) => event.stopPropagation()}>
            <div className="todo-create-modal-header">
              <h2 className="card-title">{t("dev.completeTaskModalTitle")}</h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  if (completionBusy) return;
                  setCompleteTask(null);
                  setCompletionComment("");
                  setCompletionError("");
                }}
                disabled={Boolean(completionBusy)}
              >
                <X size={12} />
                <span>{t("app.cancel")}</span>
              </button>
            </div>

            <div className="form-grid">
              <p className="todo-item-title">{completeTask.title}</p>
              {completeTask.ticket_id ? (
                <p className="muted">
                  {t("dev.completeTaskModalHintWithTicket")}{" "}
                  <Link to={`/ticket/${completeTask.ticket_id}`} className="todo-ticket-link">
                    {completeTaskTicketRef}
                  </Link>
                </p>
              ) : (
                <p className="muted">{t("dev.completeTaskModalHintWithoutTicket")}</p>
              )}

              <label className="form-group">
                <span className="form-label">{t("dev.completeCommentLabel")}</span>
                <textarea
                  className={completionError ? "form-textarea error" : "form-textarea"}
                  rows={5}
                  value={completionComment}
                  onChange={(event) => setCompletionComment(event.target.value)}
                  placeholder={t("dev.completeCommentPlaceholder")}
                />
                {completionError ? (
                  <span className="form-error-msg">{t(`errors.${completionError}`)}</span>
                ) : null}
              </label>

              <div className="todo-complete-modal-actions">
                {completeTask.ticket_id ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleCompleteTask("verify")}
                      disabled={Boolean(completionBusy)}
                    >
                      {completionBusy === "verify" ? t("app.loading") : t("dev.completeSendToVerification")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-yellow"
                      onClick={() => handleCompleteTask("close")}
                      disabled={Boolean(completionBusy)}
                    >
                      {completionBusy === "close" ? t("app.loading") : t("dev.completeCloseTicket")}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-yellow"
                    onClick={() => handleCompleteTask("close")}
                    disabled={Boolean(completionBusy)}
                  >
                    {completionBusy ? t("app.loading") : t("dev.completeTaskOnly")}
                  </button>
                )}
              </div>
            </div>
          </article>
        </div>
      ) : null}

      <section className="todo-main-grid">
        <article className="card">
          <h2 className="card-title">{t("dev.active")}</h2>
          <div className="todo-toolbar">
            <div className="todo-toolbar-left">
              <select
                className="form-select"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">{t("tickets.status")}</option>
                <option value="todo">{t("dev.taskTodo")}</option>
                <option value="in_progress">{t("dev.taskInProgress")}</option>
              </select>
              <select
                className="form-select"
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
              >
                <option value="">{t("tickets.priority")}</option>
                {PRIORITY_OPTIONS.map((priority) => (
                  <option key={priority} value={priority}>
                    {t(`priority.${priority}`)}
                  </option>
                ))}
              </select>

              {(statusFilter || priorityFilter) ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setStatusFilter("");
                    setPriorityFilter("");
                  }}
                >
                  {t("dev.clearFilters")}
                </button>
              ) : null}
            </div>

            <div className="row-actions">
              {hasActiveFilters ? (
                <span className="badge badge-no-dot">
                  {summary.totalTasks}/{summary.totalTasksAll} {t("dev.filteredActive")}
                </span>
              ) : null}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAutoSort}
                disabled={activeTasks.length < 2}
              >
                {t("dev.applyAutoSort")}
              </button>
            </div>
          </div>

          {loading ? <p>{t("app.loading")}</p> : null}
          {!loading && visibleActiveTasks.length === 0 && visibleQueueTickets.length === 0 ? (
            <p>{hasActiveFilters ? t("dev.noTasksAfterFilters") : t("dev.noActiveTasks")}</p>
          ) : null}

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
                          ticket={task.ticket_id ? ticketsMap[task.ticket_id] : null}
                          currentUserId={user?.id}
                          draft={drafts[task.id]}
                          isEditing={Boolean(drafts[task.id])}
                          onOpenPreview={openTaskPreview}
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
                        ticket={task.ticket_id ? ticketsMap[task.ticket_id] : null}
                        currentUserId={user?.id}
                        draft={drafts[task.id]}
                        isEditing={Boolean(drafts[task.id])}
                        onOpenPreview={openTaskPreview}
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

          {!loading && visibleQueueTickets.length > 0 ? (
            <section className="todo-queue-section">
              <div className="todo-queue-header">
                <h3 className="todo-queue-title">{t("dev.unassignedAcceptedTitle")}</h3>
                <span className="badge badge-no-dot">
                  {visibleQueueTickets.length}/{queuedTickets.length}
                </span>
              </div>
              <p className="muted">{t("dev.unassignedAcceptedHint")}</p>

              <ul className="list-plain">
                {visibleQueueTickets.map((ticket) => (
                  <li key={ticket.id}>
                    <div className="ticket-row-link todo-verify-row">
                      <div className="todo-verify-row-head">
                        <span>
                          #{String(ticket.number).padStart(3, "0")} · {ticket.title}
                        </span>
                        <div className="row-actions">
                          <StatusBadge status={ticket.status} />
                          <PriorityBadge priority={ticket.priority} />
                        </div>
                      </div>

                      <div className="todo-verify-row-actions">
                        <Link to={`/ticket/${ticket.id}`} className="btn btn-secondary btn-sm">
                          {t("dev.openTicket")}
                        </Link>
                        <button
                          type="button"
                          className="btn btn-yellow btn-sm"
                          onClick={() => handleClaimTicket(ticket, false)}
                          disabled={ticketActionId === ticket.id}
                        >
                          {t("dev.claimTicket")}
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleClaimTicket(ticket, true)}
                          disabled={ticketActionId === ticket.id}
                        >
                          {t("dev.claimAndStart")}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </article>

        <article className="card todo-verify-card">
          <h2 className="card-title">{t("dev.toVerifyTitle")}</h2>
          <p className="muted">{t("dev.toVerifyHint")}</p>

          {!loading && submittedTickets.length === 0 ? (
            <p>{t("dev.noTicketsToVerify")}</p>
          ) : null}

          {!loading && submittedTickets.length > 0 ? (
            <ul className="list-plain">
              {submittedTickets.map((ticket) => (
                <li key={ticket.id}>
                  <div className="ticket-row-link todo-verify-row">
                    <div className="todo-verify-row-head">
                      <span>
                        #{String(ticket.number).padStart(3, "0")} · {ticket.title}
                      </span>
                      <div className="row-actions">
                        <StatusBadge status={ticket.status} />
                        <PriorityBadge priority={ticket.priority} />
                      </div>
                    </div>

                    <div className="todo-verify-row-actions">
                      <Link to={`/ticket/${ticket.id}`} className="btn btn-secondary btn-sm">
                        {t("dev.openTicket")}
                      </Link>
                      <button
                        type="button"
                        className="btn btn-yellow btn-sm"
                        onClick={() => handleAcceptTicket(ticket, false)}
                        disabled={ticketActionId === ticket.id}
                      >
                        {t("dev.acceptTicket")}
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleAcceptTicket(ticket, true)}
                        disabled={ticketActionId === ticket.id}
                      >
                        {t("dev.acceptAndStart")}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      </section>

      <article className="card">
        <h2 className="card-title">{t("dev.done")}</h2>
        {doneTasks.length === 0 ? <p>{t("dev.noDoneTasks")}</p> : null}
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
