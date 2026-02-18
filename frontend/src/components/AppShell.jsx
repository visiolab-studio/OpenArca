import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  ChevronRight,
  KanbanSquare,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Moon,
  PlusCircle,
  Settings,
  Sun,
  Ticket
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import appLogo from "../assets/edudoro_itsc_logo.png";

const themeStorageKey = "taskflow-theme";

const baseItems = [
  { to: "/", labelKey: "nav.dashboard", icon: LayoutDashboard, end: true },
  { to: "/new-ticket", labelKey: "nav.newTicket", icon: PlusCircle },
  { to: "/my-tickets", labelKey: "nav.myTickets", icon: Ticket },
  { to: "/overview", labelKey: "nav.overview", icon: BarChart3 }
];

const developerItems = [
  { to: "/board", labelKey: "nav.board", icon: KanbanSquare },
  { to: "/dev-todo", labelKey: "nav.todo", icon: ListTodo },
  { to: "/admin", labelKey: "nav.admin", icon: Settings }
];

function resolveInitialTheme() {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(themeStorageKey);
  return stored === "dark" ? "dark" : "light";
}

function toInitials(nameOrEmail) {
  const source = String(nameOrEmail || "U").trim();
  if (!source) return "U";

  if (source.includes("@")) {
    return source.slice(0, 1).toUpperCase();
  }

  const parts = source.split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "U";
}

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user, isDeveloper, logout, updateProfile } = useAuth();
  const { language, setLanguage } = useLanguage();

  const [theme, setTheme] = useState(() => resolveInitialTheme());

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const navItems = useMemo(() => {
    return isDeveloper ? [...baseItems, ...developerItems] : baseItems;
  }, [isDeveloper]);

  const currentItem = useMemo(() => {
    if (location.pathname === "/") {
      return navItems.find((item) => item.to === "/") || navItems[0];
    }

    return (
      navItems.find((item) => {
        return item.to !== "/" && location.pathname.startsWith(item.to);
      }) || navItems[0]
    );
  }, [location.pathname, navItems]);

  const isFullWidth = location.pathname.startsWith("/board");

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

  function handleToggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem(themeStorageKey, next);
    document.documentElement.setAttribute("data-theme", next);
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <NavLink to="/" className="sidebar-logo">
            <img src={appLogo} alt="EdudoroIT logo" className="sidebar-logo-image" />
            <span>{t("app.name")}</span>
          </NavLink>
        </div>

        <div className="sidebar-section">
          <p className="sidebar-section-label">Main</p>
          {baseItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? "sidebar-item active" : "sidebar-item"
                }
              >
                <Icon className="sidebar-item-icon" />
                <span>{t(item.labelKey)}</span>
              </NavLink>
            );
          })}
        </div>

        {isDeveloper ? (
          <div className="sidebar-section">
            <p className="sidebar-section-label">Developer</p>
            {developerItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    isActive ? "sidebar-item active" : "sidebar-item"
                  }
                >
                  <Icon className="sidebar-item-icon" />
                  <span>{t(item.labelKey)}</span>
                </NavLink>
              );
            })}
          </div>
        ) : null}

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{toInitials(user?.name || user?.email)}</div>
            <div>
              <div className="text-sm">{user?.name || "User"}</div>
              <div className="text-xs muted">{user?.email}</div>
            </div>
          </div>

          <button type="button" className="theme-toggle" onClick={handleToggleTheme}>
            {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
            <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
          </button>

          <button type="button" className="theme-toggle" onClick={handleLogout}>
            <LogOut size={14} />
            <span>{t("app.logout")}</span>
          </button>
        </div>
      </aside>

      <div className="main-content">
        <header className="page-topbar">
          <div>
            <div className="page-breadcrumb">
              <span>{t("app.name")}</span>
              <ChevronRight size={12} />
              <span>{t(currentItem?.labelKey || "nav.dashboard")}</span>
            </div>
            <h1 className="page-title">{t(currentItem?.labelKey || "nav.dashboard")}</h1>
          </div>

          <div className="topbar-actions">
            <div className="lang-switch" role="group" aria-label="Language switch">
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
                <span className="flag flag-us" aria-hidden="true" />
                <span>EN</span>
              </button>
            </div>
          </div>
        </header>

        <main className={isFullWidth ? "main-scroll main-scroll-full" : "main-scroll"}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
