import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  createProject,
  deleteProject,
  deleteProjectIcon,
  getProjects,
  patchProject,
  uploadProjectIcon
} from "../api/projects";
import { API_BASE_URL } from "../api/client";
import { getSettings, patchSettings, testEmail, uploadAppLogo } from "../api/settings";
import {
  createTicketTemplate,
  deleteTicketTemplate,
  getTicketTemplates,
  patchTicketTemplate
} from "../api/ticketTemplates";
import { getUsers, patchUser } from "../api/users";
import appLogo from "../assets/logo-openarca.png";
import ProjectBadge from "../components/ProjectBadge";
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS } from "../utils/constants";

const tabs = ["app", "smtp", "projects", "users"];
const DEFAULT_PROJECT_COLOR = "#6B7280";
const EMPTY_TEMPLATE_DRAFT = {
  name: "",
  project_id: "",
  category: "bug",
  urgency_reporter: "normal",
  title_template: "",
  description_template: "",
  checklist_text: "",
  is_active: true
};

function parseError(error) {
  return error?.response?.data?.error || error?.message || "internal_error";
}

function parseValidationDetails(error) {
  const details = error?.response?.data?.details;
  if (!Array.isArray(details)) return {};

  return details.reduce((acc, item) => {
    if (!item?.path) return acc;
    acc[item.path] = item.message || "invalid";
    return acc;
  }, {});
}

function toCommaList(values) {
  if (!Array.isArray(values)) return "";
  return values.join(", ");
}

function fromCommaList(text) {
  return Array.from(
    new Set(
      String(text || "")
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function checklistItemsToText(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  return items.join("\n");
}

function checklistTextToItems(text) {
  return String(text || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toTemplateDraft(template) {
  if (!template) {
    return { ...EMPTY_TEMPLATE_DRAFT };
  }

  return {
    name: template.name || "",
    project_id: template.project_id || "",
    category: template.category || "bug",
    urgency_reporter: template.urgency_reporter || "normal",
    title_template: template.title_template || "",
    description_template: template.description_template || "",
    checklist_text: checklistItemsToText(template.checklist_items || []),
    is_active: Boolean(template.is_active)
  };
}

function validateTemplateDraft(draft) {
  const errors = {};
  const checklistItems = checklistTextToItems(draft?.checklist_text);

  const nameLength = String(draft?.name || "").trim().length;
  if (nameLength < 2 || nameLength > 120) {
    errors.name = "admin.templateValidation.name";
  }

  const titleLength = String(draft?.title_template || "").trim().length;
  if (titleLength < 5 || titleLength > 160) {
    errors.title_template = "admin.templateValidation.title";
  }

  const descriptionLength = String(draft?.description_template || "").trim().length;
  if (descriptionLength < 20 || descriptionLength > 4000) {
    errors.description_template = "admin.templateValidation.description";
  }

  if (checklistItems.length > 12) {
    errors.checklist_text = "admin.templateValidation.checklistCount";
  } else if (checklistItems.some((item) => item.length > 200)) {
    errors.checklist_text = "admin.templateValidation.checklistItem";
  }

  return errors;
}

export default function AdminPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("app");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [settings, setSettings] = useState(null);
  const [settingsForm, setSettingsForm] = useState(null);
  const [mailForm, setMailForm] = useState(null);
  const [mailTestTo, setMailTestTo] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [isLogoUploading, setIsLogoUploading] = useState(false);

  const [projects, setProjects] = useState([]);
  const [projectDrafts, setProjectDrafts] = useState({});
  const [newProject, setNewProject] = useState({ name: "", description: "", color: DEFAULT_PROJECT_COLOR });
  const [projectModalId, setProjectModalId] = useState("");
  const [projectModalDraft, setProjectModalDraft] = useState(null);
  const [projectIconFile, setProjectIconFile] = useState(null);
  const [projectModalBusy, setProjectModalBusy] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templateModalId, setTemplateModalId] = useState("");
  const [templateModalDraft, setTemplateModalDraft] = useState(null);
  const [templateModalBusy, setTemplateModalBusy] = useState(false);
  const [templateFormErrors, setTemplateFormErrors] = useState({});

  const [users, setUsers] = useState([]);
  const [userDrafts, setUserDrafts] = useState({});

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [settingsData, projectsData, templatesData, usersData] = await Promise.all([
        getSettings(),
        getProjects(),
        getTicketTemplates({ includeInactive: true }),
        getUsers()
      ]);

      setSettings(settingsData);
      setSettingsForm({
        app_name: settingsData.app_name || "",
        app_url: settingsData.app_url || "",
        allowed_domains: toCommaList(settingsData.allowed_domains || []),
        developer_emails: toCommaList(settingsData.developer_emails || [])
      });
      setMailForm({
        mail_provider: settingsData.mail_provider || "smtp",
        smtp_host: settingsData.smtp_host || "",
        smtp_port: settingsData.smtp_port || "587",
        smtp_user: settingsData.smtp_user || "",
        smtp_pass: "",
        smtp_from: settingsData.smtp_from || "",
        ses_region: settingsData.ses_region || "",
        ses_access_key_id: "",
        ses_secret_access_key: "",
        ses_session_token: "",
        ses_from: settingsData.ses_from || "",
        ses_endpoint: settingsData.ses_endpoint || ""
      });

      setProjects(projectsData);
      setTemplates(templatesData);
      setUsers(usersData);

      setProjectDrafts(
        Object.fromEntries(
          projectsData.map((project) => [
            project.id,
            {
              name: project.name || "",
              description: project.description || "",
              color: project.color || DEFAULT_PROJECT_COLOR,
              icon_url: project.icon_url || null
            }
          ])
        )
      );

      setUserDrafts(
        Object.fromEntries(
          usersData.map((user) => [
            user.id,
            {
              name: user.name || "",
              role: user.role || "user"
            }
          ])
        )
      );
    } catch (loadError) {
      setError(parseError(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const usersSorted = useMemo(() => {
    return [...users].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }, [users]);
  const templatesSorted = useMemo(() => {
    return [...templates].sort((a, b) => {
      if (a.project_id && !b.project_id) return -1;
      if (!a.project_id && b.project_id) return 1;
      const projectNameDiff = String(a.project_name || "").localeCompare(String(b.project_name || ""), "pl");
      if (projectNameDiff !== 0) return projectNameDiff;
      return String(a.name || "").localeCompare(String(b.name || ""), "pl");
    });
  }, [templates]);
  const appLogoPreviewUrl = settings?.app_logo_url ? `${API_BASE_URL}${settings.app_logo_url}` : appLogo;

  async function handleSaveAppSettings(event) {
    event.preventDefault();
    if (!settingsForm) return;

    setError("");
    setNotice("");

    try {
      const updated = await patchSettings({
        app_name: settingsForm.app_name,
        app_url: settingsForm.app_url,
        allowed_domains: fromCommaList(settingsForm.allowed_domains),
        developer_emails: fromCommaList(settingsForm.developer_emails)
      });
      setSettings(updated);
      setNotice("saved");
    } catch (saveError) {
      setError(parseError(saveError));
    }
  }

  async function handleSaveMail(event) {
    event.preventDefault();
    if (!mailForm) return;

    setError("");
    setNotice("");

    try {
      const payload = {
        mail_provider: mailForm.mail_provider,
        smtp_host: mailForm.smtp_host,
        smtp_port: Number(mailForm.smtp_port || 587),
        smtp_user: mailForm.smtp_user,
        smtp_from: mailForm.smtp_from,
        ses_region: mailForm.ses_region,
        ses_from: mailForm.ses_from
      };

      if (mailForm.ses_endpoint.trim()) {
        payload.ses_endpoint = mailForm.ses_endpoint.trim();
      }

      if (mailForm.smtp_pass.trim()) {
        payload.smtp_pass = mailForm.smtp_pass;
      }

      if (mailForm.ses_access_key_id.trim()) {
        payload.ses_access_key_id = mailForm.ses_access_key_id;
      }

      if (mailForm.ses_secret_access_key.trim()) {
        payload.ses_secret_access_key = mailForm.ses_secret_access_key;
      }

      if (mailForm.ses_session_token.trim()) {
        payload.ses_session_token = mailForm.ses_session_token;
      }

      const updated = await patchSettings(payload);
      setSettings(updated);
      setMailForm((current) => ({
        ...current,
        smtp_pass: "",
        ses_access_key_id: "",
        ses_secret_access_key: "",
        ses_session_token: ""
      }));
      setNotice("saved");
    } catch (mailError) {
      setError(parseError(mailError));
    }
  }

  async function handleUploadLogo() {
    if (!logoFile) return;

    setError("");
    setNotice("");
    setIsLogoUploading(true);

    try {
      const updated = await uploadAppLogo(logoFile);
      setSettings(updated);
      setLogoFile(null);
      setNotice("saved");
    } catch (logoError) {
      setError(parseError(logoError));
    } finally {
      setIsLogoUploading(false);
    }
  }

  async function handleTestMail() {
    if (!mailTestTo.trim()) {
      setError("validation_error");
      return;
    }

    setError("");
    setNotice("");

    try {
      const result = await testEmail({ to: mailTestTo.trim() });
      setNotice(result.mode || "saved");
    } catch (testError) {
      setError(parseError(testError));
    }
  }

  async function handleCreateProject(event) {
    event.preventDefault();
    if (!newProject.name.trim()) {
      setError("validation_error");
      return;
    }

    setError("");
    setNotice("");

    try {
      const created = await createProject({
        name: newProject.name.trim(),
        description: newProject.description.trim() || undefined,
        color: newProject.color
      });
      setProjects((current) => [created, ...current]);
      setProjectDrafts((current) => ({
        ...current,
        [created.id]: {
          name: created.name,
          description: created.description || "",
          color: created.color || "#6B7280",
          icon_url: created.icon_url || null
        }
      }));
      setNewProject({ name: "", description: "", color: "#6B7280" });
      setNotice("saved");
    } catch (createError) {
      setError(parseError(createError));
    }
  }

  function openProjectSettings(project) {
    const draft = projectDrafts[project.id] || {
      name: project.name || "",
      description: project.description || "",
      color: project.color || DEFAULT_PROJECT_COLOR,
      icon_url: project.icon_url || null
    };

    setProjectModalId(project.id);
    setProjectModalDraft({ ...draft });
    setProjectIconFile(null);
  }

  function closeProjectSettings() {
    if (projectModalBusy) return;
    setProjectModalId("");
    setProjectModalDraft(null);
    setProjectIconFile(null);
  }

  async function handleSaveProject(projectId) {
    const draft = projectModalDraft || projectDrafts[projectId];
    if (!draft) return;

    setError("");
    setNotice("");

    try {
      setProjectModalBusy(true);

      let updated = await patchProject(projectId, {
        name: draft.name,
        description: draft.description || null,
        color: draft.color
      });

      if (projectIconFile) {
        updated = await uploadProjectIcon(projectId, projectIconFile);
      }

      setProjects((current) => current.map((project) => (project.id === projectId ? updated : project)));
      setTemplates((current) =>
        current.map((template) =>
          template.project_id === projectId
            ? { ...template, project_name: updated.name || null }
            : template
        )
      );
      setProjectDrafts((current) => ({
        ...current,
        [projectId]: {
          name: updated.name || "",
          description: updated.description || "",
          color: updated.color || DEFAULT_PROJECT_COLOR,
          icon_url: updated.icon_url || null
        }
      }));
      setProjectModalDraft({
        name: updated.name || "",
        description: updated.description || "",
        color: updated.color || DEFAULT_PROJECT_COLOR,
        icon_url: updated.icon_url || null
      });
      setProjectIconFile(null);
      setNotice("saved");
    } catch (patchError) {
      setError(parseError(patchError));
    } finally {
      setProjectModalBusy(false);
    }
  }

  async function handleDeleteProjectIcon(projectId) {
    setError("");
    setNotice("");
    try {
      setProjectModalBusy(true);
      await deleteProjectIcon(projectId);
      const updated = await getProjects();
      setProjects(updated);
      const refreshed = updated.find((project) => project.id === projectId);
      if (refreshed) {
        const nextDraft = {
          name: refreshed.name || "",
          description: refreshed.description || "",
          color: refreshed.color || DEFAULT_PROJECT_COLOR,
          icon_url: refreshed.icon_url || null
        };
        setProjectDrafts((current) => ({ ...current, [projectId]: nextDraft }));
        setProjectModalDraft(nextDraft);
      }
      setProjectIconFile(null);
      setNotice("saved");
    } catch (iconError) {
      setError(parseError(iconError));
    } finally {
      setProjectModalBusy(false);
    }
  }

  async function handleDeleteProject(projectId) {
    setError("");
    setNotice("");

    try {
      await deleteProject(projectId);
      setProjects((current) => current.filter((project) => project.id !== projectId));
      const refreshedTemplates = await getTicketTemplates({ includeInactive: true });
      setTemplates(refreshedTemplates);
      setProjectDrafts((current) => {
        const next = { ...current };
        delete next[projectId];
        return next;
      });
      if (projectModalId === projectId) {
        setProjectModalId("");
        setProjectModalDraft(null);
        setProjectIconFile(null);
      }
      setNotice("saved");
    } catch (deleteError) {
      setError(parseError(deleteError));
    }
  }

  function openTemplateCreate() {
    setTemplateModalId("__new__");
    setTemplateModalDraft({ ...EMPTY_TEMPLATE_DRAFT });
    setTemplateFormErrors({});
  }

  function openTemplateSettings(template) {
    setTemplateModalId(template.id);
    setTemplateModalDraft(toTemplateDraft(template));
    setTemplateFormErrors({});
  }

  function closeTemplateSettings(force = false) {
    if (templateModalBusy && !force) return;
    setTemplateModalId("");
    setTemplateModalDraft(null);
    setTemplateFormErrors({});
  }

  function updateTemplateField(field, value) {
    setTemplateModalDraft((current) => ({ ...current, [field]: value }));
    setTemplateFormErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSaveTemplate() {
    if (!templateModalDraft) return;

    setError("");
    setNotice("");
    const localValidationErrors = validateTemplateDraft(templateModalDraft);
    setTemplateFormErrors(localValidationErrors);

    if (Object.keys(localValidationErrors).length > 0) {
      setError("validation_error");
      return;
    }

    const payload = {
      name: templateModalDraft.name.trim(),
      project_id: templateModalDraft.project_id || null,
      category: templateModalDraft.category,
      urgency_reporter: templateModalDraft.urgency_reporter,
      title_template: templateModalDraft.title_template.trim(),
      description_template: templateModalDraft.description_template.trim(),
      checklist_items: checklistTextToItems(templateModalDraft.checklist_text),
      is_active: Boolean(templateModalDraft.is_active)
    };

    try {
      setTemplateModalBusy(true);
      const saved = templateModalId === "__new__"
        ? await createTicketTemplate(payload)
        : await patchTicketTemplate(templateModalId, payload);

      setTemplates((current) => {
        if (templateModalId === "__new__") {
          return [saved, ...current];
        }
        return current.map((template) => (template.id === templateModalId ? saved : template));
      });
      setNotice("saved");
      closeTemplateSettings(true);
    } catch (templateError) {
      const validationDetails = parseValidationDetails(templateError);
      if (Object.keys(validationDetails).length > 0) {
        const mappedErrors = {};
        if (validationDetails.name) mappedErrors.name = "admin.templateValidation.name";
        if (validationDetails.title_template) mappedErrors.title_template = "admin.templateValidation.title";
        if (validationDetails.description_template) {
          mappedErrors.description_template = "admin.templateValidation.description";
        }
        if (validationDetails.checklist_items) {
          mappedErrors.checklist_text = "admin.templateValidation.checklist";
        }
        setTemplateFormErrors(mappedErrors);
      }
      setError(parseError(templateError));
    } finally {
      setTemplateModalBusy(false);
    }
  }

  async function handleDeleteTemplate(templateId) {
    setError("");
    setNotice("");

    try {
      await deleteTicketTemplate(templateId);
      setTemplates((current) => current.filter((template) => template.id !== templateId));
      if (templateModalId === templateId) {
        closeTemplateSettings();
      }
      setNotice("saved");
    } catch (templateError) {
      setError(parseError(templateError));
    }
  }

  async function handleSaveUser(userId) {
    const draft = userDrafts[userId];
    if (!draft) return;

    setError("");
    setNotice("");

    try {
      const updated = await patchUser(userId, {
        role: draft.role,
        name: draft.name || null
      });
      setUsers((current) => current.map((user) => (user.id === userId ? updated : user)));
      setNotice("saved");
    } catch (patchError) {
      setError(parseError(patchError));
    }
  }

  return (
    <section className="page-content">
      <header className="page-header">
        <h1>{t("nav.admin")}</h1>
      </header>

      <article className="card row-actions">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`btn ${activeTab === tab ? "" : "btn-ghost"}`}
            onClick={() => setActiveTab(tab)}
          >
            {t(`admin.tab${tab.charAt(0).toUpperCase()}${tab.slice(1)}`)}
          </button>
        ))}
      </article>

      {error ? <p className="feedback err">{t(`errors.${error}`, { defaultValue: error })}</p> : null}
      {notice ? <p className="feedback ok">{notice}</p> : null}

      {loading ? <article className="card">{t("app.loading")}</article> : null}

      {!loading && activeTab === "app" && settingsForm ? (
        <article className="card">
          <form className="form-grid" onSubmit={handleSaveAppSettings}>
            <label>
              {t("admin.appName")}
              <input
                type="text"
                value={settingsForm.app_name}
                onChange={(event) =>
                  setSettingsForm((current) => ({ ...current, app_name: event.target.value }))
                }
              />
            </label>

            <label>
              {t("admin.appUrl")}
              <input
                type="url"
                value={settingsForm.app_url}
                onChange={(event) =>
                  setSettingsForm((current) => ({ ...current, app_url: event.target.value }))
                }
              />
            </label>

            <label>
              {t("admin.allowedDomains")}
              <textarea
                rows={2}
                value={settingsForm.allowed_domains}
                onChange={(event) =>
                  setSettingsForm((current) => ({ ...current, allowed_domains: event.target.value }))
                }
              />
            </label>

            <label>
              {t("admin.developerEmails")}
              <textarea
                rows={2}
                value={settingsForm.developer_emails}
                onChange={(event) =>
                  setSettingsForm((current) => ({ ...current, developer_emails: event.target.value }))
                }
              />
            </label>

            <div className="admin-logo-field">
              <span className="form-label">{t("admin.appLogo")}</span>
              <p className="muted">{t("admin.appLogoHint")}</p>
              <div className="admin-logo-preview">
                <img src={appLogoPreviewUrl} alt={t("admin.currentLogo")} className="admin-logo-preview-image" />
              </div>
              <div className="row-actions">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => setLogoFile(event.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleUploadLogo}
                  disabled={!logoFile || isLogoUploading}
                >
                  {isLogoUploading ? t("app.loading") : t("admin.uploadLogo")}
                </button>
              </div>
            </div>

            <button type="submit" className="btn">{t("app.save")}</button>
          </form>
        </article>
      ) : null}

      {!loading && activeTab === "smtp" && mailForm ? (
        <article className="card">
          <form className="form-grid" onSubmit={handleSaveMail}>
            <label>
              {t("admin.mailProvider")}
              <select
                value={mailForm.mail_provider}
                onChange={(event) =>
                  setMailForm((current) => ({ ...current, mail_provider: event.target.value }))
                }
              >
                <option value="smtp">SMTP</option>
                <option value="ses">AWS SES</option>
              </select>
            </label>

            {mailForm.mail_provider === "smtp" ? (
              <>
                <label>
                  {t("admin.smtpHost")}
                  <input
                    type="text"
                    value={mailForm.smtp_host}
                    onChange={(event) =>
                      setMailForm((current) => ({ ...current, smtp_host: event.target.value }))
                    }
                  />
                </label>

                <label>
                  {t("admin.smtpPort")}
                  <input
                    type="number"
                    value={mailForm.smtp_port}
                    onChange={(event) =>
                      setMailForm((current) => ({ ...current, smtp_port: event.target.value }))
                    }
                  />
                </label>

                <label>
                  {t("admin.smtpUser")}
                  <input
                    type="text"
                    value={mailForm.smtp_user}
                    onChange={(event) =>
                      setMailForm((current) => ({ ...current, smtp_user: event.target.value }))
                    }
                  />
                </label>

                <label>
                  {t("admin.smtpPass")}
                  <input
                    type="password"
                    value={mailForm.smtp_pass}
                    onChange={(event) =>
                      setMailForm((current) => ({ ...current, smtp_pass: event.target.value }))
                    }
                    placeholder={settings?.smtp_pass ? "********" : ""}
                  />
                </label>

                <label>
                  {t("admin.smtpFrom")}
                  <input
                    type="text"
                    value={mailForm.smtp_from}
                    onChange={(event) =>
                      setMailForm((current) => ({ ...current, smtp_from: event.target.value }))
                    }
                  />
                </label>
              </>
            ) : null}

            {mailForm.mail_provider === "ses" ? (
              <>
                <label>
                  {t("admin.sesRegion")}
                  <input
                    type="text"
                    value={mailForm.ses_region}
                    onChange={(event) =>
                      setMailForm((current) => ({ ...current, ses_region: event.target.value }))
                    }
                    placeholder="eu-central-1"
                  />
                </label>

                <label>
                  {t("admin.sesAccessKeyId")}
                  <input
                    type="text"
                    value={mailForm.ses_access_key_id}
                    onChange={(event) =>
                      setMailForm((current) => ({ ...current, ses_access_key_id: event.target.value }))
                    }
                    placeholder={settings?.ses_access_key_id ? "********" : ""}
                  />
                </label>

                <label>
                  {t("admin.sesSecretAccessKey")}
                  <input
                    type="password"
                    value={mailForm.ses_secret_access_key}
                    onChange={(event) =>
                      setMailForm((current) => ({ ...current, ses_secret_access_key: event.target.value }))
                    }
                    placeholder={settings?.ses_secret_access_key ? "********" : ""}
                  />
                </label>

                <label>
                  {t("admin.sesSessionToken")}
                  <input
                    type="password"
                    value={mailForm.ses_session_token}
                    onChange={(event) =>
                      setMailForm((current) => ({ ...current, ses_session_token: event.target.value }))
                    }
                    placeholder={settings?.ses_session_token ? "********" : ""}
                  />
                </label>

                <label>
                  {t("admin.sesFrom")}
                  <input
                    type="text"
                    value={mailForm.ses_from}
                    onChange={(event) =>
                      setMailForm((current) => ({ ...current, ses_from: event.target.value }))
                    }
                    placeholder="no-reply@example.com"
                  />
                </label>

                <label>
                  {t("admin.sesEndpoint")}
                  <input
                    type="url"
                    value={mailForm.ses_endpoint}
                    onChange={(event) =>
                      setMailForm((current) => ({ ...current, ses_endpoint: event.target.value }))
                    }
                    placeholder="https://email.eu-central-1.amazonaws.com"
                  />
                </label>
              </>
            ) : null}

            <label>
              {t("admin.smtpTestTo")}
              <input
                type="email"
                placeholder="test@example.com"
                value={mailTestTo}
                onChange={(event) => setMailTestTo(event.target.value)}
              />
            </label>

            <div className="row-actions">
              <button type="submit" className="btn">{t("app.save")}</button>
              <button type="button" className="btn btn-ghost" onClick={handleTestMail}>
                {t("admin.emailTest")}
              </button>
            </div>
          </form>
        </article>
      ) : null}

      {!loading && activeTab === "projects" ? (
        <article className="card form-grid">
          <form className="form-grid" onSubmit={handleCreateProject}>
            <h2>{t("admin.newProject")}</h2>
            <div className="filters-grid">
              <input
                type="text"
                placeholder="Name"
                value={newProject.name}
                onChange={(event) =>
                  setNewProject((current) => ({ ...current, name: event.target.value }))
                }
              />
              <input
                type="text"
                placeholder="Description"
                value={newProject.description}
                onChange={(event) =>
                  setNewProject((current) => ({ ...current, description: event.target.value }))
                }
              />
              <input
                type="color"
                className="form-input admin-color-input"
                value={newProject.color}
                onChange={(event) =>
                  setNewProject((current) => ({ ...current, color: event.target.value }))
                }
              />
              <div className="admin-color-row">
                <span className="admin-color-value">{newProject.color}</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setNewProject((current) => ({ ...current, color: DEFAULT_PROJECT_COLOR }))}
                  title={t("admin.resetProjectColor")}
                  aria-label={t("admin.resetProjectColor")}
                  disabled={newProject.color.toLowerCase() === DEFAULT_PROJECT_COLOR.toLowerCase()}
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            </div>
            <button type="submit" className="btn">{t("dev.create")}</button>
          </form>

          <h2>{t("admin.projects")}</h2>
          <div className="form-grid admin-projects-list">
            {projects.map((project) => {
              return (
                <div key={project.id} className="card admin-project-row">
                  <div className="admin-project-meta">
                    <ProjectBadge
                      name={project.name}
                      color={project.color}
                      iconUrl={project.icon_url}
                      showEmpty
                    />
                    <p className="muted">{project.description || "-"}</p>
                  </div>
                  <div className="row-actions">
                    <button type="button" className="btn btn-ghost" onClick={() => openProjectSettings(project)}>
                      {t("admin.projectSettings")}
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => handleDeleteProject(project.id)}>
                      {t("dev.delete")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="admin-section-divider" />

          <div className="row-actions admin-templates-header">
            <div>
              <h2>{t("admin.ticketTemplates")}</h2>
              <p className="muted">{t("admin.ticketTemplatesHint")}</p>
            </div>
            <button type="button" className="btn btn-accent" onClick={openTemplateCreate}>
              <Plus size={14} />
              <span>{t("admin.newTicketTemplate")}</span>
            </button>
          </div>

          <div className="form-grid admin-template-list">
            {templatesSorted.map((template) => (
              <div key={template.id} className="card admin-template-card">
                <div className="admin-template-card-head">
                  <div>
                    <h3 className="admin-template-card-title">{template.name}</h3>
                    <div className="row-actions">
                      <span className="badge badge-no-dot">
                        {template.project_name || t("admin.templateGlobal")}
                      </span>
                      <span className="badge badge-no-dot">{t(`category.${template.category}`)}</span>
                      <span className="badge badge-no-dot">{t(`priority.${template.urgency_reporter}`)}</span>
                      <span className={template.is_active ? "badge badge-verified" : "badge badge-closed"}>
                        {template.is_active ? t("admin.templateActive") : t("admin.templateInactive")}
                      </span>
                    </div>
                  </div>
                  <div className="row-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => openTemplateSettings(template)}>
                      <Pencil size={12} />
                      <span>{t("admin.projectSettings")}</span>
                    </button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteTemplate(template.id)}>
                      <Trash2 size={12} />
                      <span>{t("dev.delete")}</span>
                    </button>
                  </div>
                </div>

                <div className="admin-template-preview-grid">
                  <div>
                    <span className="form-label">{t("tickets.titleField")}</span>
                    <p className="admin-template-preview-text">{template.title_template}</p>
                  </div>
                  <div>
                    <span className="form-label">{t("tickets.description")}</span>
                    <p className="admin-template-preview-text">{template.description_template}</p>
                  </div>
                </div>

                {Array.isArray(template.checklist_items) && template.checklist_items.length > 0 ? (
                  <div>
                    <span className="form-label">{t("admin.templateChecklist")}</span>
                    <ul className="admin-template-checklist">
                      {template.checklist_items.map((item) => (
                        <li key={`${template.id}-${item}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ))}

            {templatesSorted.length === 0 ? <p className="muted">{t("admin.noTicketTemplates")}</p> : null}
          </div>
        </article>
      ) : null}

      {!loading && activeTab === "projects" && projectModalId && projectModalDraft ? (
        <div className="todo-modal-backdrop" onClick={closeProjectSettings}>
          <article className="card todo-create-modal admin-project-modal" onClick={(event) => event.stopPropagation()}>
            <div className="todo-create-modal-header">
              <h2 className="card-title">{t("admin.projectSettings")}</h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={closeProjectSettings}
                disabled={projectModalBusy}
              >
                {t("app.cancel")}
              </button>
            </div>

            <div className="form-grid">
              <label className="form-group">
                <span className="form-label">{t("admin.name")}</span>
                <input
                  className="form-input"
                  type="text"
                  value={projectModalDraft.name}
                  onChange={(event) =>
                    setProjectModalDraft((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </label>

              <label className="form-group">
                <span className="form-label">{t("tickets.description")}</span>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={projectModalDraft.description}
                  onChange={(event) =>
                    setProjectModalDraft((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </label>

              <label className="form-group">
                <span className="form-label">{t("admin.projectColor")}</span>
                <input
                  className="form-input admin-color-input"
                  type="color"
                  value={projectModalDraft.color}
                  onChange={(event) =>
                    setProjectModalDraft((current) => ({ ...current, color: event.target.value }))
                  }
                />
                <div className="admin-color-row">
                  <span className="admin-color-value">{projectModalDraft.color}</span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      setProjectModalDraft((current) => ({ ...current, color: DEFAULT_PROJECT_COLOR }))
                    }
                    title={t("admin.resetProjectColor")}
                    aria-label={t("admin.resetProjectColor")}
                    disabled={projectModalDraft.color.toLowerCase() === DEFAULT_PROJECT_COLOR.toLowerCase()}
                  >
                    <RotateCcw size={12} />
                  </button>
                </div>
              </label>

              <div className="form-group">
                <span className="form-label">{t("admin.projectIcon")}</span>
                <div className="admin-project-icon-preview">
                  <ProjectBadge
                    name={projectModalDraft.name}
                    color={projectModalDraft.color}
                    iconUrl={projectModalDraft.icon_url}
                    showEmpty
                  />
                </div>
                <div className="row-actions">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => setProjectIconFile(event.target.files?.[0] || null)}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleDeleteProjectIcon(projectModalId)}
                    disabled={projectModalBusy || !projectModalDraft.icon_url}
                  >
                    {t("admin.removeProjectIcon")}
                  </button>
                </div>
              </div>
            </div>

            <div className="todo-create-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeProjectSettings}
                disabled={projectModalBusy}
              >
                {t("app.cancel")}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => handleSaveProject(projectModalId)}
                disabled={projectModalBusy}
              >
                {projectModalBusy ? t("app.loading") : t("app.save")}
              </button>
            </div>
          </article>
        </div>
      ) : null}

      {!loading && activeTab === "projects" && templateModalId && templateModalDraft ? (
        <div className="todo-modal-backdrop" onClick={() => closeTemplateSettings()}>
          <article className="card todo-create-modal admin-template-modal" onClick={(event) => event.stopPropagation()}>
            <div className="todo-create-modal-header">
              <h2 className="card-title">
                {templateModalId === "__new__" ? t("admin.newTicketTemplate") : t("admin.ticketTemplateSettings")}
              </h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => closeTemplateSettings()}
                disabled={templateModalBusy}
              >
                <X size={12} />
                <span>{t("app.cancel")}</span>
              </button>
            </div>

            <div className="form-grid">
              <label className="form-group">
                <span className="form-label">{t("admin.name")}</span>
                <input
                  className={templateFormErrors.name ? "form-input error" : "form-input"}
                  type="text"
                  value={templateModalDraft.name}
                  onChange={(event) => updateTemplateField("name", event.target.value)}
                />
                {templateFormErrors.name ? (
                  <small className="form-error-msg">{t(templateFormErrors.name)}</small>
                ) : null}
              </label>

              <label className="form-group">
                <span className="form-label">{t("tickets.project")}</span>
                <select
                  className="form-select"
                  value={templateModalDraft.project_id}
                  onChange={(event) => updateTemplateField("project_id", event.target.value)}
                >
                  <option value="">{t("admin.templateGlobal")}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="filters-grid">
                <label className="form-group">
                  <span className="form-label">{t("tickets.category")}</span>
                  <select
                    className="form-select"
                    value={templateModalDraft.category}
                    onChange={(event) => updateTemplateField("category", event.target.value)}
                  >
                    {CATEGORY_OPTIONS.map((category) => (
                      <option key={category} value={category}>
                        {t(`category.${category}`)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-group">
                  <span className="form-label">{t("tickets.urgency")}</span>
                  <select
                    className="form-select"
                    value={templateModalDraft.urgency_reporter}
                    onChange={(event) => updateTemplateField("urgency_reporter", event.target.value)}
                  >
                    {PRIORITY_OPTIONS.map((priority) => (
                      <option key={priority} value={priority}>
                        {t(`priority.${priority}`)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="check-row admin-template-active-check">
                  <input
                    type="checkbox"
                    checked={templateModalDraft.is_active}
                    onChange={(event) => updateTemplateField("is_active", event.target.checked)}
                  />
                  <span>{t("admin.templateActive")}</span>
                </label>
              </div>

              <label className="form-group">
                <span className="form-label">{t("admin.templateTitle")}</span>
                <input
                  className={templateFormErrors.title_template ? "form-input error" : "form-input"}
                  type="text"
                  value={templateModalDraft.title_template}
                  onChange={(event) => updateTemplateField("title_template", event.target.value)}
                />
                {templateFormErrors.title_template ? (
                  <small className="form-error-msg">{t(templateFormErrors.title_template)}</small>
                ) : null}
              </label>

              <label className="form-group">
                <span className="form-label">{t("admin.templateDescription")}</span>
                <textarea
                  className={templateFormErrors.description_template ? "form-textarea error" : "form-textarea"}
                  rows={5}
                  value={templateModalDraft.description_template}
                  onChange={(event) => updateTemplateField("description_template", event.target.value)}
                />
                {templateFormErrors.description_template ? (
                  <small className="form-error-msg">{t(templateFormErrors.description_template)}</small>
                ) : null}
              </label>

              <label className="form-group">
                <span className="form-label">{t("admin.templateChecklist")}</span>
                <textarea
                  className={templateFormErrors.checklist_text ? "form-textarea error" : "form-textarea"}
                  rows={5}
                  placeholder={t("admin.templateChecklistHint")}
                  value={templateModalDraft.checklist_text}
                  onChange={(event) => updateTemplateField("checklist_text", event.target.value)}
                />
                {templateFormErrors.checklist_text ? (
                  <small className="form-error-msg">{t(templateFormErrors.checklist_text)}</small>
                ) : null}
              </label>
            </div>

            <div className="todo-create-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => closeTemplateSettings()}
                disabled={templateModalBusy}
              >
                {t("app.cancel")}
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleSaveTemplate}
                disabled={templateModalBusy}
              >
                {templateModalBusy ? t("app.loading") : t("app.save")}
              </button>
            </div>
          </article>
        </div>
      ) : null}

      {!loading && activeTab === "users" ? (
        <article className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>{t("admin.name")}</th>
                <th>{t("admin.role")}</th>
                <th>{t("admin.created")}</th>
                <th>{t("admin.lastLogin")}</th>
                <th>{t("admin.action")}</th>
              </tr>
            </thead>
            <tbody>
              {usersSorted.map((user) => {
                const draft = userDrafts[user.id] || {
                  name: user.name || "",
                  role: user.role || "user"
                };

                return (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td>
                      <input
                        type="text"
                        value={draft.name}
                        onChange={(event) =>
                          setUserDrafts((current) => ({
                            ...current,
                            [user.id]: { ...draft, name: event.target.value }
                          }))
                        }
                      />
                    </td>
                    <td>
                      <select
                        value={draft.role}
                        onChange={(event) =>
                          setUserDrafts((current) => ({
                            ...current,
                            [user.id]: { ...draft, role: event.target.value }
                          }))
                        }
                      >
                        <option value="user">user</option>
                        <option value="developer">developer</option>
                      </select>
                    </td>
                    <td>{user.created_at || "-"}</td>
                    <td>{user.last_login || "-"}</td>
                    <td>
                      <button type="button" className="btn btn-ghost" onClick={() => handleSaveUser(user.id)}>
                        {t("app.save")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </article>
      ) : null}
    </section>
  );
}
