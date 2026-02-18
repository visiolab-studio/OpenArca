import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";

export default function AppShell() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isDeveloper, logout, updateProfile } = useAuth();
  const { language, setLanguage } = useLanguage();

  const links = [
    { to: "/", label: t("nav.dashboard"), end: true },
    { to: "/new-ticket", label: t("nav.newTicket") },
    { to: "/my-tickets", label: t("nav.myTickets") },
    { to: "/overview", label: t("nav.overview") }
  ];

  if (isDeveloper) {
    links.push(
      { to: "/board", label: t("nav.board") },
      { to: "/dev-todo", label: t("nav.todo") },
      { to: "/admin", label: t("nav.admin") }
    );
  }

  async function handleLanguageChange(nextLanguage) {
    setLanguage(nextLanguage);
    if (user && user.language !== nextLanguage) {
      try {
        await updateProfile({ language: nextLanguage });
      } catch (_error) {
        // keep local language even if backend sync fails
      }
    }
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="brand">
          <strong>{t("app.name")}</strong>
          <span>{user?.email}</span>
        </div>
        <nav className="main-nav">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className="nav-link">
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-actions">
          <div className="lang-switch">
            <button
              type="button"
              className={language === "pl" ? "active" : ""}
              onClick={() => handleLanguageChange("pl")}
            >
              PL
            </button>
            <button
              type="button"
              className={language === "en" ? "active" : ""}
              onClick={() => handleLanguageChange("en")}
            >
              EN
            </button>
          </div>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            {t("app.logout")}
          </button>
        </div>
      </header>

      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}
