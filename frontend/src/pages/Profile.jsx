import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { API_BASE_URL } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { useCapabilities } from "../contexts/CapabilitiesContext";

function normalizeError(error) {
  return error?.response?.data?.error || error?.message || "internal_error";
}

function toInitials(nameOrEmail) {
  const source = String(nameOrEmail || "U").trim();
  if (!source) return "U";
  const parts = source.split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || source.slice(0, 1).toUpperCase();
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user, updateProfile, uploadAvatar } = useAuth();
  const { ready: capabilitiesReady, edition, capabilities, refreshCapabilities } = useCapabilities();
  const [name, setName] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showCapabilitiesModal, setShowCapabilitiesModal] = useState(false);
  const [capabilitiesError, setCapabilitiesError] = useState("");

  useEffect(() => {
    setName(user?.name || "");
  }, [user?.name]);

  const avatarSrc = useMemo(() => {
    if (!user?.avatar_filename) return null;
    return `${API_BASE_URL}/api/auth/avatar/${user.avatar_filename}?v=${encodeURIComponent(
      user.avatar_updated_at || "1"
    )}`;
  }, [user?.avatar_filename, user?.avatar_updated_at]);

  async function handleSaveProfile(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    const normalizedName = String(name || "").trim();
    if (!normalizedName) {
      setError("validation_error");
      return;
    }

    setSaving(true);
    try {
      await updateProfile({ name: normalizedName });
      setNotice("saved");
    } catch (saveError) {
      setError(normalizeError(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadAvatar() {
    if (!avatarFile) return;
    setError("");
    setNotice("");
    setUploading(true);

    try {
      await uploadAvatar(avatarFile);
      setAvatarFile(null);
      setNotice("saved");
    } catch (uploadError) {
      setError(normalizeError(uploadError));
    } finally {
      setUploading(false);
    }
  }

  async function handleOpenCapabilitiesModal() {
    setCapabilitiesError("");
    setShowCapabilitiesModal(true);
    try {
      await refreshCapabilities();
    } catch (loadError) {
      setCapabilitiesError(normalizeError(loadError));
    }
  }

  const sortedCapabilities = useMemo(() => {
    const entries = Object.entries(capabilities || {});
    entries.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    return entries;
  }, [capabilities]);

  return (
    <section className="page-content profile-page">
      <header className="page-header">
        <h1>{t("nav.profile")}</h1>
      </header>

      {error ? <p className="feedback err">{t(`errors.${error}`, { defaultValue: error })}</p> : null}
      {notice ? <p className="feedback ok">{notice}</p> : null}

      <article className="card profile-avatar-card">
        <h2 className="card-title">{t("profile.avatar")}</h2>
        <div className="profile-avatar-row">
          <div className="profile-avatar-preview">
            {avatarSrc ? (
              <img src={avatarSrc} alt={user?.name || user?.email || "User"} className="profile-avatar-image" />
            ) : (
              <span>{toInitials(user?.name || user?.email)}</span>
            )}
          </div>

          <div className="profile-avatar-actions">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => setAvatarFile(event.target.files?.[0] || null)}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleUploadAvatar}
              disabled={!avatarFile || uploading}
            >
              {uploading ? t("app.loading") : t("profile.uploadAvatar")}
            </button>
          </div>
        </div>
      </article>

      <article className="card">
        <h2 className="card-title">{t("profile.title")}</h2>
        <form className="form-grid" onSubmit={handleSaveProfile}>
          <label>
            {t("profile.fullName")}
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("profile.fullNamePlaceholder")}
            />
          </label>

          <label>
            {t("profile.email")}
            <input type="email" value={user?.email || ""} disabled />
          </label>

          <div className="row-actions">
            <button type="submit" className="btn" disabled={saving}>
              {saving ? t("app.loading") : t("profile.save")}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleOpenCapabilitiesModal}>
              {t("profile.showCapabilities")}
            </button>
          </div>
        </form>
      </article>

      {showCapabilitiesModal ? (
        <div className="todo-modal-backdrop" onClick={() => setShowCapabilitiesModal(false)}>
          <article className="card todo-create-modal" onClick={(event) => event.stopPropagation()}>
            <div className="todo-create-modal-header">
              <h2 className="card-title">{t("profile.capabilitiesTitle")}</h2>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCapabilitiesModal(false)}>
                {t("app.cancel")}
              </button>
            </div>

            <p className="muted">{t("profile.capabilitiesHint")}</p>
            <div className="capabilities-meta">
              <span className="badge badge-no-dot">
                {t("profile.editionLabel")}: {edition}
              </span>
              <span className="badge badge-no-dot">
                {t("profile.flagsCount", { count: sortedCapabilities.length })}
              </span>
            </div>

            {capabilitiesError ? (
              <p className="feedback err">{t(`errors.${capabilitiesError}`, { defaultValue: capabilitiesError })}</p>
            ) : null}

            {!capabilitiesReady ? <p className="muted">{t("app.loading")}</p> : null}

            <ul className="list-plain capabilities-list">
              {sortedCapabilities.map(([key, enabled]) => (
                <li key={key} className="capabilities-row">
                  <span className="capabilities-key">{key}</span>
                  <span className={enabled ? "badge badge-closed" : "badge badge-blocked"}>
                    {enabled ? t("profile.enabled") : t("profile.disabled")}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      ) : null}
    </section>
  );
}
