import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  addExternalReference,
  addRelatedTicket,
  addAttachments,
  addComment,
  deleteExternalReference,
  deleteRelatedTicket,
  getTicket,
  patchTicket
} from "../api/tickets";
import { getUsers } from "../api/users";
import { API_BASE_URL } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import StatusBadge from "../components/StatusBadge";
import PriorityBadge from "../components/PriorityBadge";
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS, STATUS_OPTIONS } from "../utils/constants";
import { formatDate, formatDateShort } from "../utils/format";

function parseError(error) {
  return error?.response?.data?.error || error?.message || "internal_error";
}

function toInitial(value) {
  const source = String(value || "U").trim();
  return source ? source[0].toUpperCase() : "U";
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
  const [developerUsers, setDeveloperUsers] = useState([]);
  const [isQuickAccepting, setIsQuickAccepting] = useState(false);
  const [closureSummaryText, setClosureSummaryText] = useState("");
  const [relatedTicketNumber, setRelatedTicketNumber] = useState("");
  const [relatedBusy, setRelatedBusy] = useState(false);
  const [externalRefForm, setExternalRefForm] = useState({
    ref_type: "git_pr",
    url: "",
    title: ""
  });
  const [externalRefBusy, setExternalRefBusy] = useState(false);

  const [editForm, setEditForm] = useState(null);

  const assigneeMap = useMemo(
    () =>
      new Map(
        developerUsers.map((user) => [
          user.id,
          user.name ? `${user.name} (${user.email})` : user.email
        ])
      ),
    [developerUsers]
  );

  const assigneeLabel = useMemo(() => {
    if (!ticket?.assignee_id) return t("tickets.unassigned");
    return assigneeMap.get(ticket.assignee_id) || ticket.assignee_id;
  }, [ticket?.assignee_id, assigneeMap, t]);

  async function loadTicket() {
    setLoading(true);
    setError("");

    try {
      const [response, users] = await Promise.all([
        getTicket(id),
        isDeveloper ? getUsers() : Promise.resolve([])
      ]);

      if (isDeveloper) {
        const developers = (users || [])
          .filter((user) => user.role === "developer")
          .sort((a, b) =>
            String(a.name || a.email).localeCompare(String(b.name || b.email), "pl")
          );
        setDeveloperUsers(developers);
      } else {
        setDeveloperUsers([]);
      }

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
        assignee_id: response.assignee_id || "",
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

  const hasClosureSummary = useMemo(() => {
    if (!ticket?.comments) return false;
    return ticket.comments.some(
      (comment) => Number(comment.is_closure_summary) === 1 && Number(comment.is_internal) !== 1
    );
  }, [ticket?.comments]);

  async function handleUpdateTicket(event) {
    event.preventDefault();
    if (!editForm) return;

    setError("");

    try {
      if (isDeveloper) {
        const isClosingTransition = ticket.status !== "closed" && editForm.status === "closed";
        const summaryToSave = closureSummaryText.trim();

        if (isClosingTransition) {
          if (!summaryToSave && !hasClosureSummary) {
            setError("closure_summary_required");
            return;
          }

          if (summaryToSave) {
            await addComment(id, {
              content: summaryToSave,
              type: "comment",
              is_internal: false,
              is_closure_summary: true
            });
          }
        }

        await patchTicket(id, {
          status: editForm.status,
          priority: editForm.priority,
          assignee_id: editForm.assignee_id || null,
          planned_date: editForm.planned_date || null,
          estimated_hours:
            editForm.estimated_hours === "" ? null : Number(editForm.estimated_hours),
          internal_note: editForm.internal_note || null,
          category: editForm.category
        });
        setClosureSummaryText("");
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

  async function handleQuickAccept() {
    if (!ticket) return;

    setError("");
    setIsQuickAccepting(true);

    try {
      await patchTicket(id, { status: "verified" });
      await loadTicket();
    } catch (acceptError) {
      setError(parseError(acceptError));
    } finally {
      setIsQuickAccepting(false);
    }
  }

  async function handleAddRelated(event) {
    event.preventDefault();
    if (!isDeveloper || !relatedTicketNumber.trim()) return;

    const number = Number.parseInt(relatedTicketNumber, 10);
    if (!Number.isInteger(number) || number <= 0) {
      setError("validation_error");
      return;
    }

    setError("");
    setRelatedBusy(true);
    try {
      await addRelatedTicket(id, { related_ticket_number: number });
      setRelatedTicketNumber("");
      await loadTicket();
    } catch (relatedError) {
      setError(parseError(relatedError));
    } finally {
      setRelatedBusy(false);
    }
  }

  async function handleRemoveRelated(relatedId) {
    if (!isDeveloper) return;
    setError("");
    setRelatedBusy(true);
    try {
      await deleteRelatedTicket(id, relatedId);
      await loadTicket();
    } catch (relatedError) {
      setError(parseError(relatedError));
    } finally {
      setRelatedBusy(false);
    }
  }

  async function handleAddExternalReference(event) {
    event.preventDefault();
    if (!isDeveloper) return;

    const url = String(externalRefForm.url || "").trim();
    if (!url) {
      setError("validation_error");
      return;
    }

    setError("");
    setExternalRefBusy(true);
    try {
      await addExternalReference(id, {
        ref_type: externalRefForm.ref_type,
        url,
        title: String(externalRefForm.title || "").trim() || undefined
      });
      setExternalRefForm({
        ref_type: externalRefForm.ref_type,
        url: "",
        title: ""
      });
      await loadTicket();
    } catch (externalError) {
      setError(parseError(externalError));
    } finally {
      setExternalRefBusy(false);
    }
  }

  async function handleDeleteExternalReference(refId) {
    if (!isDeveloper) return;
    setError("");
    setExternalRefBusy(true);
    try {
      await deleteExternalReference(id, refId);
      await loadTicket();
    } catch (externalError) {
      setError(parseError(externalError));
    } finally {
      setExternalRefBusy(false);
    }
  }

  if (loading) {
    return <section className="card">{t("app.loading")}</section>;
  }

  if (!ticket) {
    return <section className="card">{t("tickets.loadError")}</section>;
  }

  return (
    <section className="page-content ticket-detail-page">
      <header className="page-header">
        <div>
          <p className="ticket-number">#{String(ticket.number).padStart(3, "0")}</p>
          <h1 className="issue-summary">{ticket.title}</h1>
        </div>
        <div className="row-actions">
          {isDeveloper && ticket.status === "submitted" ? (
            <button
              type="button"
              className="btn btn-yellow"
              onClick={handleQuickAccept}
              disabled={isQuickAccepting}
            >
              {isQuickAccepting ? t("app.loading") : t("dev.acceptTicket")}
            </button>
          ) : null}
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
        </div>
      </header>

      {error ? <p className="feedback err">{t(`errors.${error}`, { defaultValue: error })}</p> : null}

      <div className="ticket-detail">
        <div className="ticket-main">
          <article className="card issue-card">
            <section className="issue-section">
              <h3 className="issue-section-title">{t("tickets.description")}</h3>
              <div className="issue-rich-text">{ticket.description || "-"}</div>
            </section>

            {ticket.steps_to_reproduce ? (
              <section className="issue-section">
                <h3 className="issue-section-title">{t("tickets.steps")}</h3>
                <div className="issue-rich-text">{ticket.steps_to_reproduce}</div>
              </section>
            ) : null}

            {ticket.expected_result ? (
              <section className="issue-section">
                <h3 className="issue-section-title">{t("tickets.expected")}</h3>
                <div className="issue-rich-text">{ticket.expected_result}</div>
              </section>
            ) : null}

            {ticket.actual_result ? (
              <section className="issue-section">
                <h3 className="issue-section-title">{t("tickets.actual")}</h3>
                <div className="issue-rich-text">{ticket.actual_result}</div>
              </section>
            ) : null}

            {ticket.environment ? (
              <section className="issue-section">
                <h3 className="issue-section-title">{t("tickets.environment")}</h3>
                <div className="issue-rich-text">{ticket.environment}</div>
              </section>
            ) : null}
          </article>

          {(isDeveloper || canUserEdit) && editForm ? (
            <article className="card issue-edit-card">
              <h2 className="card-title">{t("app.save")}</h2>
              <form className="form-grid" onSubmit={handleUpdateTicket}>
                {!isDeveloper ? (
                  <>
                    <label className="form-group">
                      <span className="form-label">{t("tickets.titleField")}</span>
                      <input
                        className="form-input"
                        type="text"
                        value={editForm.title}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, title: event.target.value }))
                        }
                      />
                    </label>
                    <label className="form-group">
                      <span className="form-label">{t("tickets.description")}</span>
                      <textarea
                        className="form-textarea"
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
                  <div className="filters-grid">
                    <label className="form-group">
                      <span className="form-label">{t("tickets.status")}</span>
                      <select
                        className="form-select"
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

                    <label className="form-group">
                      <span className="form-label">{t("tickets.priority")}</span>
                      <select
                        className="form-select"
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

                    <label className="form-group">
                      <span className="form-label">{t("tickets.category")}</span>
                      <select
                        className="form-select"
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

                    <label className="form-group">
                      <span className="form-label">{t("tickets.assignee")}</span>
                      <select
                        className="form-select"
                        value={editForm.assignee_id || ""}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, assignee_id: event.target.value }))
                        }
                      >
                        <option value="">{t("tickets.unassigned")}</option>
                        {developerUsers.map((developer) => (
                          <option key={developer.id} value={developer.id}>
                            {developer.name ? `${developer.name} (${developer.email})` : developer.email}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="form-group">
                      <span className="form-label">{t("tickets.plannedDate")}</span>
                      <input
                        className="form-input"
                        type="date"
                        value={editForm.planned_date || ""}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, planned_date: event.target.value }))
                        }
                      />
                    </label>

                    <label className="form-group">
                      <span className="form-label">{t("tickets.estimatedHours")}</span>
                      <input
                        className="form-input"
                        type="number"
                        step="0.5"
                        min="0"
                        value={editForm.estimated_hours}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, estimated_hours: event.target.value }))
                        }
                      />
                    </label>

                    <label className="form-group">
                      <span className="form-label">{t("tickets.internalNote")}</span>
                      <textarea
                        className="form-textarea"
                        rows={3}
                        value={editForm.internal_note || ""}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, internal_note: event.target.value }))
                        }
                      />
                    </label>

                    {ticket.status !== "closed" && editForm.status === "closed" ? (
                      <label className="form-group form-group-wide">
                        <span className="form-label">{t("tickets.closureSummaryLabel")}</span>
                        <textarea
                          className="form-textarea"
                          rows={4}
                          value={closureSummaryText}
                          placeholder={t("tickets.closureSummaryPlaceholder")}
                          onChange={(event) => setClosureSummaryText(event.target.value)}
                        />
                        <small className="form-hint">{t("tickets.closureSummaryHint")}</small>
                      </label>
                    ) : null}
                  </div>
                ) : null}

                <button className="btn btn-primary" type="submit">
                  {t("app.save")}
                </button>
              </form>
            </article>
          ) : null}

          <article className="card">
            <h2 className="card-title">{t("tickets.attachments")}</h2>
            <ul className="list-plain attachment-list">
              {ticket.attachments?.map((attachment) => (
                <li key={attachment.id}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleDownload(attachment)}
                  >
                    {attachment.original_name}
                  </button>
                </li>
              ))}
            </ul>
            <form className="row-actions" onSubmit={handleUpload}>
              <input
                className="form-input"
                type="file"
                multiple
                onChange={(event) => setUploadFiles(Array.from(event.target.files || []))}
              />
              <button type="submit" className="btn btn-primary">
                {t("app.submit")}
              </button>
            </form>
          </article>

          <article className="card">
            <h2 className="card-title">{t("tickets.comments")}</h2>
            <ul className="comments-thread">
              {ticket.comments?.map((comment) => {
                const author = comment.user_name || comment.user_email || "User";
                return (
                  <li
                    key={comment.id}
                    className={`comment ${comment.is_developer ? "developer" : "user"} ${
                      comment.type === "question" ? "question" : ""
                    }`}
                  >
                    <div className="comment-avatar">{toInitial(author)}</div>
                    <div className="comment-body">
                      <div className="comment-meta">
                        <span className="comment-author">{author}</span>
                        {comment.is_developer ? (
                          <span className="comment-developer-badge">Developer</span>
                        ) : null}
                        <span className="comment-time">{formatDate(comment.created_at)}</span>
                        {comment.is_internal ? <span className="badge">{t("tickets.internal")}</span> : null}
                      </div>
                      <p className="comment-content">{comment.content}</p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <form className="form-grid" onSubmit={handleAddComment}>
              <label className="form-group">
                <span className="form-label">{t("tickets.commentType")}</span>
                <select
                  className="form-select"
                  value={commentType}
                  onChange={(event) => setCommentType(event.target.value)}
                >
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

              <label className="form-group">
                <span className="form-label">{t("tickets.addComment")}</span>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                />
              </label>

              <button className="btn btn-primary" type="submit">
                {t("app.submit")}
              </button>
            </form>
          </article>

          <article className="card">
            <h2 className="card-title">{t("tickets.history")}</h2>
            <ul className="list-plain">
              {ticket.history?.map((entry) => (
                <li key={entry.id} className="history-item">
                  <span className="history-dot" />
                  <span>
                    <span className="muted">{formatDate(entry.created_at)}</span>{" "}
                    {entry.user_name || entry.user_email || "System"}: {entry.field}{" "}
                    {String(entry.old_value ?? "-")} → {String(entry.new_value ?? "-")}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        </div>

        <aside className="ticket-sidebar">
          <article className="ticket-meta-card">
            <div className="ticket-meta-row">
              <span className="ticket-meta-label">{t("tickets.status")}</span>
              <StatusBadge status={ticket.status} />
            </div>
            <div className="ticket-meta-row">
              <span className="ticket-meta-label">{t("tickets.priority")}</span>
              <PriorityBadge priority={ticket.priority} />
            </div>
            <div className="ticket-meta-row">
              <span className="ticket-meta-label">{t("tickets.category")}</span>
              <span>{t(`category.${ticket.category}`)}</span>
            </div>
            <div className="ticket-meta-row">
              <span className="ticket-meta-label">{t("tickets.assignee")}</span>
              <span>{assigneeLabel}</span>
            </div>
            <div className="ticket-meta-row">
              <span className="ticket-meta-label">{t("tickets.plannedDate")}</span>
              <span>{formatDateShort(ticket.planned_date)}</span>
            </div>
            <div className="ticket-meta-row">
              <span className="ticket-meta-label">{t("tickets.estimatedHours")}</span>
              <span>{ticket.estimated_hours ?? "-"}</span>
            </div>
            <div className="ticket-meta-row">
              <span className="ticket-meta-label">{t("tickets.createdAt")}</span>
              <span>{formatDate(ticket.created_at)}</span>
            </div>
            <div className="ticket-meta-row">
              <span className="ticket-meta-label">{t("tickets.updatedAt")}</span>
              <span>{formatDate(ticket.updated_at)}</span>
            </div>
          </article>

          {ticket.internal_note ? (
            <article className="internal-note">
              <div className="internal-note-header">{t("tickets.internalNote")}</div>
              <p>{ticket.internal_note}</p>
            </article>
          ) : null}

          <article className="card">
            <h2 className="card-title">{t("tickets.relatedTitle")}</h2>

            {Array.isArray(ticket.related_tickets) && ticket.related_tickets.length > 0 ? (
              <ul className="list-plain">
                {ticket.related_tickets.map((related) => (
                  <li key={related.id} className="related-ticket-item">
                    <Link to={`/ticket/${related.id}`} className="related-ticket-link">
                      <span className="related-ticket-ref">#{String(related.number).padStart(3, "0")}</span>
                      <span className="related-ticket-title">{related.title}</span>
                    </Link>
                    <div className="related-ticket-badges">
                      <StatusBadge status={related.status} />
                      <PriorityBadge priority={related.priority} />
                      {isDeveloper ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleRemoveRelated(related.id)}
                          disabled={relatedBusy}
                        >
                          {t("tickets.relatedRemove")}
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{t("tickets.relatedEmpty")}</p>
            )}

            {isDeveloper ? (
              <form className="row-actions" onSubmit={handleAddRelated}>
                <input
                  className="form-input"
                  type="number"
                  min="1"
                  value={relatedTicketNumber}
                  placeholder={t("tickets.relatedAddPlaceholder")}
                  onChange={(event) => setRelatedTicketNumber(event.target.value)}
                />
                <button type="submit" className="btn btn-primary" disabled={relatedBusy}>
                  {relatedBusy ? t("app.loading") : t("tickets.relatedAdd")}
                </button>
              </form>
            ) : null}
          </article>

          <article className="card">
            <h2 className="card-title">{t("tickets.externalRefsTitle")}</h2>

            {Array.isArray(ticket.external_references) && ticket.external_references.length > 0 ? (
              <ul className="list-plain">
                {ticket.external_references.map((ref) => (
                  <li key={ref.id} className="external-ref-item">
                    <a
                      className="external-ref-link"
                      href={ref.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className="badge badge-no-dot">{t(`tickets.externalRefType.${ref.ref_type}`)}</span>
                      <span className="external-ref-title">
                        {ref.title || ref.url}
                      </span>
                    </a>
                    <div className="external-ref-meta">
                      {isDeveloper ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDeleteExternalReference(ref.id)}
                          disabled={externalRefBusy}
                        >
                          {t("tickets.externalRefRemove")}
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{t("tickets.externalRefsEmpty")}</p>
            )}

            {isDeveloper ? (
              <form className="form-grid" onSubmit={handleAddExternalReference}>
                <div className="filters-grid">
                  <select
                    className="form-select"
                    value={externalRefForm.ref_type}
                    onChange={(event) =>
                      setExternalRefForm((current) => ({ ...current, ref_type: event.target.value }))
                    }
                  >
                    <option value="git_pr">{t("tickets.externalRefType.git_pr")}</option>
                    <option value="deployment">{t("tickets.externalRefType.deployment")}</option>
                    <option value="monitoring">{t("tickets.externalRefType.monitoring")}</option>
                    <option value="other">{t("tickets.externalRefType.other")}</option>
                  </select>

                  <input
                    className="form-input"
                    type="url"
                    placeholder={t("tickets.externalRefUrlPlaceholder")}
                    value={externalRefForm.url}
                    onChange={(event) =>
                      setExternalRefForm((current) => ({ ...current, url: event.target.value }))
                    }
                  />

                  <input
                    className="form-input"
                    type="text"
                    placeholder={t("tickets.externalRefTitlePlaceholder")}
                    value={externalRefForm.title}
                    onChange={(event) =>
                      setExternalRefForm((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </div>
                <div className="row-actions">
                  <button type="submit" className="btn btn-primary" disabled={externalRefBusy}>
                    {externalRefBusy ? t("app.loading") : t("tickets.externalRefAdd")}
                  </button>
                </div>
              </form>
            ) : null}
          </article>
        </aside>
      </div>
    </section>
  );
}
