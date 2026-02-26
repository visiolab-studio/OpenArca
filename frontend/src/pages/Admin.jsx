import { useEffect, useMemo, useState } from "react";
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
import { getUsers, patchUser } from "../api/users";
import appLogo from "../assets/logo-openarca.png";
import ProjectBadge from "../components/ProjectBadge";

const tabs = ["app", "smtp", "projects", "users"];

function parseError(error) {
  return error?.response?.data?.error || error?.message || "internal_error";
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
  const [newProject, setNewProject] = useState({ name: "", description: "", color: "#6B7280" });
  const [projectModalId, setProjectModalId] = useState("");
  const [projectModalDraft, setProjectModalDraft] = useState(null);
  const [projectIconFile, setProjectIconFile] = useState(null);
  const [projectModalBusy, setProjectModalBusy] = useState(false);

  const [users, setUsers] = useState([]);
  const [userDrafts, setUserDrafts] = useState({});

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [settingsData, projectsData, usersData] = await Promise.all([
        getSettings(),
        getProjects(),
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
      setUsers(usersData);

      setProjectDrafts(
        Object.fromEntries(
          projectsData.map((project) => [
            project.id,
            {
              name: project.name || "",
              description: project.description || "",
              color: project.color || "#6B7280",
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
      color: project.color || "#6B7280",
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
      setProjectDrafts((current) => ({
        ...current,
        [projectId]: {
          name: updated.name || "",
          description: updated.description || "",
          color: updated.color || "#6B7280",
          icon_url: updated.icon_url || null
        }
      }));
      setProjectModalDraft({
        name: updated.name || "",
        description: updated.description || "",
        color: updated.color || "#6B7280",
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
          color: refreshed.color || "#6B7280",
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
                value={newProject.color}
                onChange={(event) =>
                  setNewProject((current) => ({ ...current, color: event.target.value }))
                }
              />
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
                  className="form-input"
                  type="color"
                  value={projectModalDraft.color}
                  onChange={(event) =>
                    setProjectModalDraft((current) => ({ ...current, color: event.target.value }))
                  }
                />
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
