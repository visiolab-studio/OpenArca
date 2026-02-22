import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createTicket } from "../api/tickets";
import { getProjects } from "../api/projects";
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS } from "../utils/constants";

const steps = [1, 2, 3, 4];

const categoryMeta = {
  bug: { icon: "🐞", desc: "newTicket.catBugDesc" },
  feature: { icon: "✨", desc: "newTicket.catFeatureDesc" },
  improvement: { icon: "🛠️", desc: "newTicket.catImprovementDesc" },
  question: { icon: "❓", desc: "newTicket.catQuestionDesc" },
  other: { icon: "📌", desc: "newTicket.catOtherDesc" }
};

function toMb(files) {
  const bytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
  return (bytes / 1024 / 1024).toFixed(2);
}

function charCountClass(current, min) {
  if (current <= 0) return "form-char-count";
  if (current < min) return "form-char-count warning";
  return "form-char-count";
}

export function validateNewTicketForm(form) {
  const errors = {};

  if ((form.title || "").trim().length < 10) {
    errors.title = "tickets.validation.title";
  }

  const descriptionLength = (form.description || "").trim().length;
  const minDescription =
    form.category === "bug" || form.category === "feature" || form.category === "improvement"
      ? 100
      : 50;
  if (descriptionLength < minDescription) {
    errors.description = "tickets.validation.description";
  }

  if (form.category === "bug") {
    if ((form.steps_to_reproduce || "").trim().length < 30)
      errors.steps_to_reproduce = "tickets.validation.steps";
    if ((form.expected_result || "").trim().length < 20)
      errors.expected_result = "tickets.validation.expected";
    if ((form.actual_result || "").trim().length < 20)
      errors.actual_result = "tickets.validation.actual";
    if ((form.environment || "").trim().length < 10)
      errors.environment = "tickets.validation.environment";
  }

  if (["feature", "improvement"].includes(form.category)) {
    if ((form.business_goal || "").trim().length < 30)
      errors.business_goal = "tickets.validation.businessGoal";
  }

  if (form.category === "question") {
    if ((form.question_context || "").trim().length < 30)
      errors.question_context = "tickets.validation.questionContext";
  }

  return errors;
}

export default function NewTicketPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [confirmed, setConfirmed] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    steps_to_reproduce: "",
    expected_result: "",
    actual_result: "",
    environment: "",
    urgency_reporter: "normal",
    category: "bug",
    project_id: "",
    business_goal: "",
    question_context: ""
  });

  const [files, setFiles] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadProjects() {
      try {
        const rows = await getProjects();
        if (active) setProjects(rows);
      } catch (_error) {
        // keep form available even if projects fail
      }
    }

    loadProjects();
    return () => {
      active = false;
    };
  }, []);

  const errors = useMemo(() => validateNewTicketForm(form), [form]);

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function moveStep(direction) {
    setStep((current) => Math.min(4, Math.max(1, current + direction)));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const hasErrors = Object.keys(errors).length > 0;
    if (hasErrors || !confirmed) {
      setError("validation_error");
      return;
    }

    setLoading(true);

    try {
      const payload = new FormData();
      payload.append("title", form.title.trim());

      let description = form.description.trim();
      if (["feature", "improvement"].includes(form.category)) {
        description += `\n\nBusiness Goal:\n${form.business_goal.trim()}`;
      }
      if (form.category === "question") {
        description += `\n\nContext:\n${form.question_context.trim()}`;
      }

      payload.append("description", description);
      payload.append("urgency_reporter", form.urgency_reporter);
      payload.append("category", form.category);

      if (form.project_id) payload.append("project_id", form.project_id);

      if (form.category === "bug") {
        payload.append("steps_to_reproduce", form.steps_to_reproduce.trim());
        payload.append("expected_result", form.expected_result.trim());
        payload.append("actual_result", form.actual_result.trim());
        payload.append("environment", form.environment.trim());
      }

      if (["feature", "improvement"].includes(form.category)) {
        payload.append("expected_result", form.business_goal.trim());
      }

      if (form.category === "question") {
        payload.append("steps_to_reproduce", form.question_context.trim());
      }

      for (const file of files) {
        payload.append("attachments", file);
      }

      const ticket = await createTicket(payload);
      navigate(`/ticket/${ticket.id}`);
    } catch (submitError) {
      setError(submitError?.response?.data?.error || submitError.message || "internal_error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page-content new-ticket-page">
      <header className="new-ticket-header">
        <h1 className="new-ticket-title">{t("tickets.newTitle")}</h1>
        <p className="new-ticket-subtitle">{t("dashboard.subtitle")}</p>
      </header>

      <div className="form-progress">
        {steps.map((item) => (
          <div
            key={item}
            className={
              step === item ? "form-step active" : step > item ? "form-step done" : "form-step"
            }
          >
            <div className="form-step-circle">{item}</div>
            <div className="form-step-label">{t(`newTicket.step${item}`)}</div>
          </div>
        ))}
      </div>

      <form className="card form-grid" onSubmit={handleSubmit}>
        {step === 1 ? (
          <>
            <div className="form-instruction-box">
              <div className="form-instruction-box-title">{t("tickets.titleField")}</div>
              <p>
                {t(
                  "newTicket.titleHint",
                  "Napisz precyzyjny tytuł. Unikaj ogólników typu 'nie działa'."
                )}
              </p>
            </div>

            <div className="form-examples">
              <div className="form-example form-example-bad">
                <div className="form-example-label">{t("newTicket.badExample", "Zły przykład")}</div>
                <div>{t("newTicket.badTitle", "Nie działa formularz")}</div>
              </div>
              <div className="form-example form-example-good">
                <div className="form-example-label">{t("newTicket.goodExample", "Dobry przykład")}</div>
                <div>
                  {t(
                    "newTicket.goodTitle",
                    "Błąd zapisu formularza zamówienia po kliknięciu Zatwierdź"
                  )}
                </div>
              </div>
            </div>

            <label className="form-group">
              <span className="form-label">{t("tickets.project")}</span>
              <select
                className="form-select"
                value={form.project_id}
                onChange={(event) => updateField("project_id", event.target.value)}
              >
                <option value="">-</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <p className="form-label">{t("tickets.category")}</p>
              <div className="category-selector">
                {CATEGORY_OPTIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={
                      form.category === value
                        ? "category-option selected"
                        : "category-option"
                    }
                    onClick={() => updateField("category", value)}
                  >
                    <span className="category-option-icon">{categoryMeta[value].icon}</span>
                    <span className="category-option-label">{t(`category.${value}`)}</span>
                    <span className="category-option-desc">
                      {t(categoryMeta[value].desc, t(`category.${value}`))}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <label className="form-group">
              <span className="form-label">{t("tickets.titleField")}</span>
              <input
                type="text"
                className={errors.title ? "form-input error" : "form-input"}
                value={form.title}
                onChange={(event) => updateField("title", event.target.value)}
                maxLength={300}
                required
              />
              <div className={charCountClass(form.title.trim().length, 10)}>
                {form.title.trim().length}/300
              </div>
              {errors.title ? <small className="form-error-msg">{t(errors.title)}</small> : null}
            </label>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="form-instruction-box">
              <div className="form-instruction-box-title">{t("tickets.description")}</div>
              <p>
                {form.category === "bug"
                  ? t(
                      "newTicket.bugHint",
                      "Opisz dokładnie kiedy i jak często problem występuje oraz jak go odtworzyć."
                    )
                  : t(
                      "newTicket.generalHint",
                      "Opisz szczegółowo kontekst i oczekiwany efekt biznesowy."
                    )}
              </p>
            </div>

            <label className="form-group">
              <span className="form-label">{t("tickets.description")}</span>
              <textarea
                rows={6}
                className={errors.description ? "form-textarea error" : "form-textarea"}
                value={form.description}
                onChange={(event) => updateField("description", event.target.value)}
                required
              />
              <div className={charCountClass(form.description.trim().length, 100)}>
                {form.description.trim().length}/20000
              </div>
              {errors.description ? <small className="form-error-msg">{t(errors.description)}</small> : null}
            </label>

            {form.category === "bug" ? (
              <>
                <label className="form-group">
                  <span className="form-label">{t("tickets.steps")}</span>
                  <textarea
                    rows={3}
                    className={errors.steps_to_reproduce ? "form-textarea error" : "form-textarea"}
                    value={form.steps_to_reproduce}
                    onChange={(event) => updateField("steps_to_reproduce", event.target.value)}
                  />
                  {errors.steps_to_reproduce ? (
                    <small className="form-error-msg">{t(errors.steps_to_reproduce)}</small>
                  ) : null}
                </label>

                <label className="form-group">
                  <span className="form-label">{t("tickets.expected")}</span>
                  <textarea
                    rows={3}
                    className={errors.expected_result ? "form-textarea error" : "form-textarea"}
                    value={form.expected_result}
                    onChange={(event) => updateField("expected_result", event.target.value)}
                  />
                  {errors.expected_result ? (
                    <small className="form-error-msg">{t(errors.expected_result)}</small>
                  ) : null}
                </label>

                <label className="form-group">
                  <span className="form-label">{t("tickets.actual")}</span>
                  <textarea
                    rows={3}
                    className={errors.actual_result ? "form-textarea error" : "form-textarea"}
                    value={form.actual_result}
                    onChange={(event) => updateField("actual_result", event.target.value)}
                  />
                  {errors.actual_result ? (
                    <small className="form-error-msg">{t(errors.actual_result)}</small>
                  ) : null}
                </label>

                <label className="form-group">
                  <span className="form-label">{t("tickets.environment")}</span>
                  <input
                    type="text"
                    className={errors.environment ? "form-input error" : "form-input"}
                    value={form.environment}
                    onChange={(event) => updateField("environment", event.target.value)}
                  />
                  {errors.environment ? (
                    <small className="form-error-msg">{t(errors.environment)}</small>
                  ) : null}
                </label>
              </>
            ) : null}

            {["feature", "improvement"].includes(form.category) ? (
              <label className="form-group">
                <span className="form-label">{t("newTicket.businessGoal")}</span>
                <textarea
                  rows={3}
                  className={errors.business_goal ? "form-textarea error" : "form-textarea"}
                  value={form.business_goal}
                  onChange={(event) => updateField("business_goal", event.target.value)}
                />
                {errors.business_goal ? (
                  <small className="form-error-msg">{t(errors.business_goal)}</small>
                ) : null}
              </label>
            ) : null}

            {form.category === "question" ? (
              <label className="form-group">
                <span className="form-label">{t("newTicket.questionContext")}</span>
                <textarea
                  rows={3}
                  className={errors.question_context ? "form-textarea error" : "form-textarea"}
                  value={form.question_context}
                  onChange={(event) => updateField("question_context", event.target.value)}
                />
                {errors.question_context ? (
                  <small className="form-error-msg">{t(errors.question_context)}</small>
                ) : null}
              </label>
            ) : null}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <label className="form-group">
              <span className="form-label">{t("tickets.urgency")}</span>
              <select
                className="form-select"
                value={form.urgency_reporter}
                onChange={(event) => updateField("urgency_reporter", event.target.value)}
              >
                {PRIORITY_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {t(`priority.${value}`)}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-group">
              <span className="form-label">{t("tickets.attachments")}</span>
              <input
                type="file"
                className="form-input"
                multiple
                onChange={(event) => setFiles(Array.from(event.target.files || []))}
              />
              <small className="form-hint">
                {files.length} file(s), {toMb(files)} MB
              </small>
            </label>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <article className="preview-box ticket-preview-jira">
              <header className="preview-jira-header">
                <span className="ticket-number">NEW-XXXX</span>
                <div className="row-actions">
                  <span className="badge badge-no-dot">{t(`category.${form.category}`)}</span>
                  <span className="badge badge-no-dot">{t(`priority.${form.urgency_reporter}`)}</span>
                </div>
              </header>

              <h3 className="preview-jira-title">{form.title || "-"}</h3>

              <section className="preview-jira-section">
                <p className="preview-jira-label">{t("tickets.description")}</p>
                <div className="preview-jira-text">{form.description || "-"}</div>
              </section>

              {form.steps_to_reproduce ? (
                <section className="preview-jira-section">
                  <p className="preview-jira-label">{t("tickets.steps")}</p>
                  <div className="preview-jira-text">{form.steps_to_reproduce}</div>
                </section>
              ) : null}

              {form.expected_result ? (
                <section className="preview-jira-section">
                  <p className="preview-jira-label">{t("tickets.expected")}</p>
                  <div className="preview-jira-text">{form.expected_result}</div>
                </section>
              ) : null}

              {form.actual_result ? (
                <section className="preview-jira-section">
                  <p className="preview-jira-label">{t("tickets.actual")}</p>
                  <div className="preview-jira-text">{form.actual_result}</div>
                </section>
              ) : null}

              {form.environment ? (
                <section className="preview-jira-section">
                  <p className="preview-jira-label">{t("tickets.environment")}</p>
                  <div className="preview-jira-text">{form.environment}</div>
                </section>
              ) : null}

              {files.length > 0 ? (
                <section className="preview-jira-section">
                  <p className="preview-jira-label">{t("tickets.attachments")}</p>
                  <ul className="preview-file-list">
                    {files.map((file) => (
                      <li key={`${file.name}-${file.size}-${file.lastModified}`}>{file.name}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </article>

            <label className="check-row">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>{t("newTicket.confirm")}</span>
            </label>
          </>
        ) : null}

        {error ? <p className="feedback err">{t(`errors.${error}`, { defaultValue: error })}</p> : null}

        <div className="row-actions">
          <button type="button" className="btn btn-secondary" onClick={() => moveStep(-1)} disabled={step === 1}>
            {t("app.back")}
          </button>

          {step < 4 ? (
            <button type="button" className="btn btn-primary" onClick={() => moveStep(1)}>
              {t("app.next")}
            </button>
          ) : (
            <button type="submit" className="btn btn-yellow" disabled={loading}>
              {t("app.submit")}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
