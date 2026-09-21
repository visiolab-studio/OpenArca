import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import client from "../api/client";
import CustomFieldsInput from "../components/CustomFieldsInput";
import { SUPPORTED_LANGUAGES, normalizeLanguage } from "../i18n";

// Public submission form. Rendered OUTSIDE the app shell and outside any auth
// guard — the visitor has no account and may never get one.
//
// This is the first OpenArca surface a stranger sees, so it stays deliberately
// plain: one card, one column, obvious next step. Nothing clever.

const MIN_TITLE = 10;
const MIN_DESCRIPTION = 50;

export default function PublicIntakePage() {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();

  const [project, setProject] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", title: "", description: "" });
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState(null);
  const [error, setError] = useState("");

  // A visitor arrives with no stored preference, so the link may carry one.
  useEffect(() => {
    const requested = searchParams.get("lang");
    if (requested && SUPPORTED_LANGUAGES.includes(requested)) {
      i18n.changeLanguage(normalizeLanguage(requested));
    }
  }, [searchParams, i18n]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        // Without an id in the URL the portal is resolved from the host. Core
        // has no such mapping; a layer may provide one, and when none does this
        // simply reports the form as unavailable.
        const response = projectId
          ? await client.get(`/api/public/projects/${projectId}`)
          : await client.get("/api/public/portal");

        if (!active) return;

        const data = response.data;
        if (!projectId && data.project_id) {
          const details = await client.get(`/api/public/projects/${data.project_id}`);
          setProject({ ...details.data, ...data, id: data.project_id });
          return;
        }

        setProject(data);
      } catch {
        // A disabled project and a missing one answer identically by design, so
        // there is nothing more specific to say here.
        if (active) setLoadError(true);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [projectId]);

  const validation = useMemo(() => {
    const issues = {};
    if (!form.email.trim() || !form.email.includes("@")) issues.email = t("public.errorEmail");
    if (form.title.trim().length < MIN_TITLE) issues.title = t("public.errorTitle");
    if (form.description.trim().length < MIN_DESCRIPTION) {
      issues.description = t("public.errorDescription");
    }
    return issues;
  }, [form, t]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (Object.keys(validation).length > 0) {
      setFieldErrors(validation);
      return;
    }

    setSubmitting(true);
    try {
      const filled = Object.fromEntries(
        Object.entries(customFieldValues).filter(([, value]) => String(value ?? "").trim() !== "")
      );

      const response = await client.post("/api/public/intake", {
        project_id: project.id,
        email: form.email.trim(),
        ...(form.name.trim() ? { name: form.name.trim() } : {}),
        title: form.title.trim(),
        description: form.description.trim(),
        lang: i18n.language,
        ...(Object.keys(filled).length > 0 ? { custom_fields: filled } : {})
      });

      setReference(response.data.reference);
    } catch (submitError) {
      const status = submitError?.response?.status;
      if (status === 429) {
        setError(t("public.errorTooMany"));
      } else {
        const field = submitError?.response?.data?.field;
        const message = submitError?.response?.data?.message;
        if (field && message) {
          setFieldErrors({ [field]: message });
        }
        setError(t("public.errorGeneric"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <main className="public-page">
        <article className="card public-card">
          <h1 className="card-title">{t("public.unavailableTitle")}</h1>
          <p className="muted">{t("public.unavailableHint")}</p>
        </article>
      </main>
    );
  }

  if (reference) {
    return (
      <main className="public-page">
        <article className="card public-card">
          <h1 className="card-title">{t("public.successTitle")}</h1>
          <p className="public-reference">{reference}</p>
          <p className="muted">{t("public.successHint")}</p>
        </article>
      </main>
    );
  }

  return (
    <main className="public-page">
      <article className="card public-card">
        <h1 className="card-title">{project?.title || t("public.title")}</h1>
        <p className="muted">{project ? project.intro || project.name : t("app.loading")}</p>

        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <label className="form-group">
            <span className="form-label">{t("public.email")}</span>
            <input
              className="form-input"
              type="email"
              autoComplete="email"
              value={form.email}
              aria-invalid={fieldErrors.email ? "true" : undefined}
              onChange={(event) => setForm((c) => ({ ...c, email: event.target.value }))}
            />
            {fieldErrors.email ? (
              <small className="form-error" role="alert">{fieldErrors.email}</small>
            ) : null}
          </label>

          <label className="form-group">
            <span className="form-label">{t("public.name")}</span>
            <input
              className="form-input"
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))}
            />
          </label>

          <label className="form-group">
            <span className="form-label">{t("public.subject")}</span>
            <input
              className="form-input"
              type="text"
              value={form.title}
              aria-invalid={fieldErrors.title ? "true" : undefined}
              onChange={(event) => setForm((c) => ({ ...c, title: event.target.value }))}
            />
            {fieldErrors.title ? (
              <small className="form-error" role="alert">{fieldErrors.title}</small>
            ) : null}
          </label>

          <label className="form-group">
            <span className="form-label">{t("public.description")}</span>
            <textarea
              className="form-input"
              rows={7}
              value={form.description}
              aria-invalid={fieldErrors.description ? "true" : undefined}
              onChange={(event) => setForm((c) => ({ ...c, description: event.target.value }))}
            />
            <small className="form-hint">{t("public.descriptionHint")}</small>
            {fieldErrors.description ? (
              <small className="form-error" role="alert">{fieldErrors.description}</small>
            ) : null}
          </label>

          <CustomFieldsInput
            definitions={project?.custom_fields || []}
            values={customFieldValues}
            errors={fieldErrors}
            disabled={submitting}
            onChange={(key, value) =>
              setCustomFieldValues((current) => ({ ...current, [key]: value }))
            }
          />

          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <button type="submit" className="btn btn-primary" disabled={submitting || !project}>
            {submitting ? t("app.loading") : t("public.submit")}
          </button>
        </form>
      </article>
    </main>
  );
}
