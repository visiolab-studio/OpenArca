import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import appLogo from "../assets/edudoro_itsc_logo.png";

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
          <img src={appLogo} alt="EdudoroIT logo" className="brand-logo" />
          <div className="brand-copy">
            <strong>{t("app.name")}</strong>
            <span>{user?.email}</span>
          </div>
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
              className={language === "pl" ? "lang-option active" : "lang-option"}
              onClick={() => handleLanguageChange("pl")}
            >
              <span className="flag flag-pl" aria-hidden="true" />
              <span>PL</span>
            </button>
            <button
              type="button"
              className={language === "en" ? "lang-option active" : "lang-option"}
              onClick={() => handleLanguageChange("en")}
            >
              <span className="flag flag-en" aria-hidden="true" />
              <span>EN</span>
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
