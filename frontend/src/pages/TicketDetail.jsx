import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  addAttachments,
  addComment,
  getTicket,
  patchTicket
} from "../api/tickets";
import { API_BASE_URL } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import StatusBadge from "../components/StatusBadge";
import PriorityBadge from "../components/PriorityBadge";
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS, STATUS_OPTIONS } from "../utils/constants";
import { formatDate, formatDateShort } from "../utils/format";

function parseError(error) {
  return error?.response?.data?.error || error?.message || "internal_error";
}

export default function TicketDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { isDeveloper, token } = useAuth();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [commentText, setCommentText] = useState("");
  const [commentType, setCommentType] = useState("comment");
  const [commentInternal, setCommentInternal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);

  const [editForm, setEditForm] = useState(null);

  async function loadTicket() {
    setLoading(true);
    setError("");

    try {
      const response = await getTicket(id);
      setTicket(response);
      setEditForm({
        title: response.title || "",
        description: response.description || "",
        steps_to_reproduce: response.steps_to_reproduce || "",
        expected_result: response.expected_result || "",
        actual_result: response.actual_result || "",
        environment: response.environment || "",
        category: response.category || "other",
        status: response.status || "submitted",
        priority: response.priority || "normal",
        planned_date: response.planned_date || "",
        estimated_hours: response.estimated_hours ?? "",
        internal_note: response.internal_note || ""
      });
    } catch (ticketError) {
      setError(parseError(ticketError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTicket();
  }, [id]);

  const canUserEdit = useMemo(() => {
    if (!ticket) return false;
    return !isDeveloper && ticket.status === "submitted";
  }, [ticket, isDeveloper]);

  async function handleUpdateTicket(event) {
    event.preventDefault();
    if (!editForm) return;

    setError("");

    try {
      if (isDeveloper) {
        await patchTicket(id, {
          status: editForm.status,
          priority: editForm.priority,
          planned_date: editForm.planned_date || null,
          estimated_hours:
            editForm.estimated_hours === "" ? null : Number(editForm.estimated_hours),
          internal_note: editForm.internal_note || null,
          category: editForm.category
        });
      } else {
        await patchTicket(id, {
          title: editForm.title,
          description: editForm.description,
          steps_to_reproduce: editForm.steps_to_reproduce || undefined,
          expected_result: editForm.expected_result || undefined,
          actual_result: editForm.actual_result || undefined,
          environment: editForm.environment || undefined
        });
      }

      await loadTicket();
    } catch (patchError) {
      setError(parseError(patchError));
    }
  }

  async function handleAddComment(event) {
    event.preventDefault();
    if (!commentText.trim()) return;

    setError("");

    try {
      await addComment(id, {
        content: commentText.trim(),
        type: commentType,
        is_internal: isDeveloper ? commentInternal : false
      });
      setCommentText("");
      setCommentType("comment");
      setCommentInternal(false);
      await loadTicket();
    } catch (commentError) {
      setError(parseError(commentError));
    }
  }

  async function handleUpload(event) {
    event.preventDefault();
    if (!uploadFiles.length) return;

    setError("");

    try {
      await addAttachments(id, uploadFiles);
      setUploadFiles([]);
      await loadTicket();
    } catch (uploadError) {
      setError(parseError(uploadError));
    }
  }

  async function handleDownload(attachment) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/uploads/${attachment.filename}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error("download_failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.original_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (_error) {
      setError("internal_error");
    }
  }

  if (loading) {
    return <section className="card">{t("app.loading")}</section>;
  }

  if (!ticket) {
    return <section className="card">{t("tickets.loadError")}</section>;
  }

  return (
    <section className="page-content ticket-layout">
      <header className="page-header">
        <h1>{t("tickets.detailTitle")} #{String(ticket.number).padStart(3, "0")}</h1>
        <div className="row-actions">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
        </div>
      </header>

      {error ? <p className="feedback err">{t(`errors.${error}`, { defaultValue: error })}</p> : null}

      <article className="card">
        <h2>{ticket.title}</h2>
        <p>{ticket.description}</p>
        <div className="meta-grid">
          <p><strong>{t("tickets.category")}:</strong> {t(`category.${ticket.category}`)}</p>
          <p><strong>{t("tickets.createdAt")}:</strong> {formatDate(ticket.created_at)}</p>
          <p><strong>{t("tickets.updatedAt")}:</strong> {formatDate(ticket.updated_at)}</p>
          <p><strong>{t("tickets.plannedDate")}:</strong> {formatDateShort(ticket.planned_date)}</p>
          <p><strong>{t("tickets.estimatedHours")}:</strong> {ticket.estimated_hours ?? "-"}</p>
        </div>

        {ticket.steps_to_reproduce ? <p><strong>{t("tickets.steps")}:</strong> {ticket.steps_to_reproduce}</p> : null}
        {ticket.expected_result ? <p><strong>{t("tickets.expected")}:</strong> {ticket.expected_result}</p> : null}
        {ticket.actual_result ? <p><strong>{t("tickets.actual")}:</strong> {ticket.actual_result}</p> : null}
        {ticket.environment ? <p><strong>{t("tickets.environment")}:</strong> {ticket.environment}</p> : null}
      </article>

      {(isDeveloper || canUserEdit) && editForm ? (
        <article className="card">
          <h2>{t("app.save")}</h2>
          <form className="form-grid" onSubmit={handleUpdateTicket}>
            {!isDeveloper ? (
              <>
                <label>
                  {t("tickets.titleField")}
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </label>
                <label>
                  {t("tickets.description")}
                  <textarea
                    rows={4}
                    value={editForm.description}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, description: event.target.value }))
                    }
                  />
                </label>
              </>
            ) : null}

            {isDeveloper ? (
              <>
                <label>
                  {t("tickets.status")}
                  <select
                    value={editForm.status}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, status: event.target.value }))
                    }
                  >
                    {STATUS_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {t(`status.${value}`)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  {t("tickets.priority")}
                  <select
                    value={editForm.priority}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, priority: event.target.value }))
                    }
                  >
                    {PRIORITY_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {t(`priority.${value}`)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  {t("tickets.category")}
                  <select
                    value={editForm.category}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, category: event.target.value }))
                    }
                  >
                    {CATEGORY_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {t(`category.${value}`)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  {t("tickets.plannedDate")}
                  <input
                    type="date"
                    value={editForm.planned_date || ""}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, planned_date: event.target.value }))
                    }
                  />
                </label>

                <label>
                  {t("tickets.estimatedHours")}
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={editForm.estimated_hours}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, estimated_hours: event.target.value }))
                    }
                  />
                </label>

                <label>
                  {t("tickets.internalNote")}
                  <textarea
                    rows={3}
                    value={editForm.internal_note || ""}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, internal_note: event.target.value }))
                    }
                  />
                </label>
              </>
            ) : null}

            <button className="btn" type="submit">
              {t("app.save")}
            </button>
          </form>
        </article>
      ) : null}

      <article className="card">
        <h2>{t("tickets.attachments")}</h2>
        <ul className="list-plain">
          {ticket.attachments?.map((attachment) => (
            <li key={attachment.id}>
              <button type="button" className="btn btn-ghost" onClick={() => handleDownload(attachment)}>
                {attachment.original_name}
              </button>
            </li>
          ))}
        </ul>
        <form className="row-actions" onSubmit={handleUpload}>
          <input
            type="file"
            multiple
            onChange={(event) => setUploadFiles(Array.from(event.target.files || []))}
          />
          <button type="submit" className="btn">
            {t("app.submit")}
          </button>
        </form>
      </article>

      <article className="card">
        <h2>{t("tickets.comments")}</h2>
        <ul className="list-plain comments-list">
          {ticket.comments?.map((comment) => (
            <li key={comment.id} className={comment.is_internal ? "comment-internal" : ""}>
              <div className="comment-meta">
                <span>{comment.user_name || comment.user_email || "User"}</span>
                <span className="muted">{formatDate(comment.created_at)}</span>
                {comment.is_internal ? <span className="badge">{t("tickets.internal")}</span> : null}
              </div>
              <p>{comment.content}</p>
            </li>
          ))}
        </ul>

        <form className="form-grid" onSubmit={handleAddComment}>
          <label>
            {t("tickets.commentType")}
            <select value={commentType} onChange={(event) => setCommentType(event.target.value)}>
              <option value="comment">comment</option>
              <option value="question">question</option>
              <option value="answer">answer</option>
            </select>
          </label>

          {isDeveloper ? (
            <label className="check-row">
              <input
                type="checkbox"
                checked={commentInternal}
                onChange={(event) => setCommentInternal(event.target.checked)}
              />
              <span>{t("tickets.internal")}</span>
            </label>
          ) : null}

          <label>
            {t("tickets.addComment")}
            <textarea
              rows={3}
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
            />
          </label>

          <button className="btn" type="submit">
            {t("app.submit")}
          </button>
        </form>
      </article>

      <article className="card">
        <h2>{t("tickets.history")}</h2>
        <ul className="list-plain">
          {ticket.history?.map((entry) => (
            <li key={entry.id}>
              <span className="muted">{formatDate(entry.created_at)}</span>
              <span>
                {entry.user_name || entry.user_email || "System"}: {entry.field} {String(entry.old_value ?? "-")} → {String(entry.new_value ?? "-")}
              </span>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
