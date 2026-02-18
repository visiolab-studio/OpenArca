import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createTicket } from "../api/tickets";
import { getProjects } from "../api/projects";
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS } from "../utils/constants";

const steps = [1, 2, 3, 4];

function toNumber(value) {
  return Number(value || 0);
}

export function validateNewTicketForm(form) {
  const errors = {};

  if ((form.title || "").trim().length < 10) {
    errors.title = "tickets.validation.title";
  }

  const descriptionLength = (form.description || "").trim().length;
  const minDescription = form.category === "bug" || form.category === "feature" || form.category === "improvement" ? 100 : 50;
  if (descriptionLength < minDescription) {
    errors.description = "tickets.validation.description";
  }

  if (form.category === "bug") {
    if ((form.steps_to_reproduce || "").trim().length < 30) errors.steps_to_reproduce = "tickets.validation.steps";
    if ((form.expected_result || "").trim().length < 20) errors.expected_result = "tickets.validation.expected";
    if ((form.actual_result || "").trim().length < 20) errors.actual_result = "tickets.validation.actual";
    if ((form.environment || "").trim().length < 10) errors.environment = "tickets.validation.environment";
  }

  if (["feature", "improvement"].includes(form.category)) {
    if ((form.business_goal || "").trim().length < 30) errors.business_goal = "tickets.validation.businessGoal";
  }

  if (form.category === "question") {
    if ((form.question_context || "").trim().length < 30) errors.question_context = "tickets.validation.questionContext";
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

  const progress = `${step}/${steps.length}`;

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
    <section className="page-content">
      <header className="page-header">
        <h1>{t("tickets.newTitle")}</h1>
        <p>{progress}</p>
      </header>

      <form className="card form-grid" onSubmit={handleSubmit}>
        <div className="steps-row">
          <span className={step === 1 ? "step-chip active" : "step-chip"}>{t("newTicket.step1")}</span>
          <span className={step === 2 ? "step-chip active" : "step-chip"}>{t("newTicket.step2")}</span>
          <span className={step === 3 ? "step-chip active" : "step-chip"}>{t("newTicket.step3")}</span>
          <span className={step === 4 ? "step-chip active" : "step-chip"}>{t("newTicket.step4")}</span>
        </div>

        {step === 1 ? (
          <>
            <label>
              {t("tickets.project")}
              <select value={form.project_id} onChange={(event) => updateField("project_id", event.target.value)}>
                <option value="">-</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {t("tickets.category")}
              <select value={form.category} onChange={(event) => updateField("category", event.target.value)}>
                {CATEGORY_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {t(`category.${value}`)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {t("tickets.titleField")}
              <input
                type="text"
                value={form.title}
                onChange={(event) => updateField("title", event.target.value)}
                minLength={10}
                maxLength={300}
                required
              />
              {errors.title ? <small className="error-text">{t(errors.title)}</small> : null}
            </label>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <label>
              {t("tickets.description")}
              <textarea
                rows={6}
                value={form.description}
                onChange={(event) => updateField("description", event.target.value)}
                required
              />
              {errors.description ? <small className="error-text">{t(errors.description)}</small> : null}
            </label>

            {form.category === "bug" ? (
              <>
                <label>
                  {t("tickets.steps")}
                  <textarea
                    rows={3}
                    value={form.steps_to_reproduce}
                    onChange={(event) => updateField("steps_to_reproduce", event.target.value)}
                  />
                  {errors.steps_to_reproduce ? <small className="error-text">{t(errors.steps_to_reproduce)}</small> : null}
                </label>
                <label>
                  {t("tickets.expected")}
                  <textarea
                    rows={3}
                    value={form.expected_result}
                    onChange={(event) => updateField("expected_result", event.target.value)}
                  />
                  {errors.expected_result ? <small className="error-text">{t(errors.expected_result)}</small> : null}
                </label>
                <label>
                  {t("tickets.actual")}
                  <textarea
                    rows={3}
                    value={form.actual_result}
                    onChange={(event) => updateField("actual_result", event.target.value)}
                  />
                  {errors.actual_result ? <small className="error-text">{t(errors.actual_result)}</small> : null}
                </label>
                <label>
                  {t("tickets.environment")}
                  <input
                    type="text"
                    value={form.environment}
                    onChange={(event) => updateField("environment", event.target.value)}
                  />
                  {errors.environment ? <small className="error-text">{t(errors.environment)}</small> : null}
                </label>
              </>
            ) : null}

            {["feature", "improvement"].includes(form.category) ? (
              <label>
                {t("newTicket.businessGoal")}
                <textarea
                  rows={3}
                  value={form.business_goal}
                  onChange={(event) => updateField("business_goal", event.target.value)}
                />
                {errors.business_goal ? <small className="error-text">{t(errors.business_goal)}</small> : null}
              </label>
            ) : null}

            {form.category === "question" ? (
              <label>
                {t("newTicket.questionContext")}
                <textarea
                  rows={3}
                  value={form.question_context}
                  onChange={(event) => updateField("question_context", event.target.value)}
                />
                {errors.question_context ? <small className="error-text">{t(errors.question_context)}</small> : null}
              </label>
            ) : null}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <label>
              {t("tickets.urgency")}
              <select
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

            <label>
              {t("tickets.attachments")}
              <input
                type="file"
                multiple
                onChange={(event) => setFiles(Array.from(event.target.files || []))}
              />
              <small>{files.length} file(s), {toNumber(files.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(2)} MB</small>
            </label>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <article className="preview-box">
              <h3>#{form.title || "-"}</h3>
              <p><strong>{t("tickets.category")}:</strong> {t(`category.${form.category}`)}</p>
              <p><strong>{t("tickets.urgency")}:</strong> {t(`priority.${form.urgency_reporter}`)}</p>
              <p>{form.description || "-"}</p>
              {files.length > 0 ? <p><strong>{t("tickets.attachments")}:</strong> {files.map((file) => file.name).join(", ")}</p> : null}
            </article>
            <label className="check-row">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
              <span>{t("newTicket.confirm")}</span>
            </label>
          </>
        ) : null}

        {error ? <p className="feedback err">{t(`errors.${error}`, { defaultValue: error })}</p> : null}

        <div className="row-actions">
          <button type="button" className="btn btn-ghost" onClick={() => moveStep(-1)} disabled={step === 1}>
            {t("app.back")}
          </button>
          {step < 4 ? (
            <button type="button" className="btn" onClick={() => moveStep(1)}>
              {t("app.next")}
            </button>
          ) : (
            <button type="submit" className="btn" disabled={loading}>
              {t("app.submit")}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
