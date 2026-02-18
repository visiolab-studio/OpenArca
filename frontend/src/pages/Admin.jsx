import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { createProject, deleteProject, getProjects, patchProject } from "../api/projects";
import { getSettings, patchSettings, testSmtp } from "../api/settings";
import { getUsers, patchUser } from "../api/users";

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
  const [smtpForm, setSmtpForm] = useState(null);
  const [smtpTestTo, setSmtpTestTo] = useState("");

  const [projects, setProjects] = useState([]);
  const [projectDrafts, setProjectDrafts] = useState({});
  const [newProject, setNewProject] = useState({ name: "", description: "", color: "#6B7280" });

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
      setSmtpForm({
        smtp_host: settingsData.smtp_host || "",
        smtp_port: settingsData.smtp_port || "587",
        smtp_user: settingsData.smtp_user || "",
        smtp_pass: "",
        smtp_from: settingsData.smtp_from || ""
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
              color: project.color || "#6B7280"
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

  async function handleSaveSmtp(event) {
    event.preventDefault();
    if (!smtpForm) return;

    setError("");
    setNotice("");

    try {
      const payload = {
        smtp_host: smtpForm.smtp_host,
        smtp_port: Number(smtpForm.smtp_port || 587),
        smtp_user: smtpForm.smtp_user,
        smtp_from: smtpForm.smtp_from
      };

      if (smtpForm.smtp_pass.trim()) {
        payload.smtp_pass = smtpForm.smtp_pass;
      }

      const updated = await patchSettings(payload);
      setSettings(updated);
      setSmtpForm((current) => ({ ...current, smtp_pass: "" }));
      setNotice("saved");
    } catch (smtpError) {
      setError(parseError(smtpError));
    }
  }

  async function handleTestSmtp() {
    if (!smtpTestTo.trim()) {
      setError("validation_error");
      return;
    }

    setError("");
    setNotice("");

    try {
      const result = await testSmtp({ to: smtpTestTo.trim() });
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
          color: created.color || "#6B7280"
        }
      }));
      setNewProject({ name: "", description: "", color: "#6B7280" });
      setNotice("saved");
    } catch (createError) {
      setError(parseError(createError));
    }
  }

  async function handleSaveProject(projectId) {
    const draft = projectDrafts[projectId];
    if (!draft) return;

    setError("");
    setNotice("");

    try {
      const updated = await patchProject(projectId, {
        name: draft.name,
        description: draft.description || null,
        color: draft.color
      });
      setProjects((current) => current.map((project) => (project.id === projectId ? updated : project)));
      setNotice("saved");
    } catch (patchError) {
      setError(parseError(patchError));
    }
  }

  async function handleDeleteProject(projectId) {
    setError("");
    setNotice("");

    try {
      await deleteProject(projectId);
      setProjects((current) => current.filter((project) => project.id !== projectId));
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

            <button type="submit" className="btn">{t("app.save")}</button>
          </form>
        </article>
      ) : null}

      {!loading && activeTab === "smtp" && smtpForm ? (
        <article className="card">
          <form className="form-grid" onSubmit={handleSaveSmtp}>
            <label>
              {t("admin.smtpHost")}
              <input
                type="text"
                value={smtpForm.smtp_host}
                onChange={(event) =>
                  setSmtpForm((current) => ({ ...current, smtp_host: event.target.value }))
                }
              />
            </label>

            <label>
              {t("admin.smtpPort")}
              <input
                type="number"
                value={smtpForm.smtp_port}
                onChange={(event) =>
                  setSmtpForm((current) => ({ ...current, smtp_port: event.target.value }))
                }
              />
            </label>

            <label>
              {t("admin.smtpUser")}
              <input
                type="text"
                value={smtpForm.smtp_user}
                onChange={(event) =>
                  setSmtpForm((current) => ({ ...current, smtp_user: event.target.value }))
                }
              />
            </label>

            <label>
              {t("admin.smtpPass")}
              <input
                type="password"
                value={smtpForm.smtp_pass}
                onChange={(event) =>
                  setSmtpForm((current) => ({ ...current, smtp_pass: event.target.value }))
                }
                placeholder={settings?.smtp_pass ? "********" : ""}
              />
            </label>

            <label>
              {t("admin.smtpFrom")}
              <input
                type="text"
                value={smtpForm.smtp_from}
                onChange={(event) =>
                  setSmtpForm((current) => ({ ...current, smtp_from: event.target.value }))
                }
              />
            </label>

            <div className="row-actions">
              <button type="submit" className="btn">{t("app.save")}</button>
              <input
                type="email"
                placeholder="test@example.com"
                value={smtpTestTo}
                onChange={(event) => setSmtpTestTo(event.target.value)}
              />
              <button type="button" className="btn btn-ghost" onClick={handleTestSmtp}>
                {t("admin.smtpTest")}
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
          <div className="form-grid">
            {projects.map((project) => {
              const draft = projectDrafts[project.id] || {
                name: project.name,
                description: project.description || "",
                color: project.color || "#6B7280"
              };

              return (
                <div key={project.id} className="card">
                  <div className="filters-grid">
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(event) =>
                        setProjectDrafts((current) => ({
                          ...current,
                          [project.id]: { ...draft, name: event.target.value }
                        }))
                      }
                    />
                    <input
                      type="text"
                      value={draft.description}
                      onChange={(event) =>
                        setProjectDrafts((current) => ({
                          ...current,
                          [project.id]: { ...draft, description: event.target.value }
                        }))
                      }
                    />
                    <input
                      type="color"
                      value={draft.color}
                      onChange={(event) =>
                        setProjectDrafts((current) => ({
                          ...current,
                          [project.id]: { ...draft, color: event.target.value }
                        }))
                      }
                    />
                  </div>
                  <div className="row-actions">
                    <button type="button" className="btn btn-ghost" onClick={() => handleSaveProject(project.id)}>
                      {t("app.save")}
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
