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
import appLogo from "../assets/logo-openarca.png";
import openArcaLogoGrey from "../assets/logo-openarca-grey.png";
import polandFlag from "../assets/poland.png";
import unitedStatesFlag from "../assets/united-states.png";
import { API_BASE_URL } from "../api/client";
import { getPublicSettings } from "../api/settings";
import appPackage from "../../package.json";

const themeStorageKey = "taskflow-theme";

const baseItems = [
  { to: "/", labelKey: "nav.dashboard", icon: LayoutDashboard, end: true },
  { to: "/new-ticket", labelKey: "nav.newTicket", icon: PlusCircle },
  { to: "/my-tickets", labelKey: "nav.myTickets", icon: Ticket },
  { to: "/overview", labelKey: "nav.overview", icon: BarChart3 }
];

const developerItems = [
  { to: "/board", labelKey: "nav.board", icon: KanbanSquare },
  { to: "/dev-todo", labelKey: "nav.todo", icon: ListTodo }
];

const adminItem = { to: "/admin", labelKey: "nav.admin", icon: Settings };
const openArcaUrl = "https://www.openarca.com";
const openArcaLicenseUrl = "https://github.com/visiolab-studio/OpenArca/blob/main/LICENSE";

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
  const [branding, setBranding] = useState({
    app_name: "",
    app_logo_url: null
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    let isMounted = true;

    getPublicSettings()
      .then((payload) => {
        if (!isMounted || !payload) return;
        setBranding({
          app_name: String(payload.app_name || "").trim(),
          app_logo_url: payload.app_logo_url || null
        });
      })
      .catch(() => {
        // Sidebar uses static fallback when public settings are unavailable.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const navItems = useMemo(() => {
    return isDeveloper ? [...baseItems, ...developerItems] : baseItems;
  }, [isDeveloper]);

  const titleItems = useMemo(() => {
    return [...navItems, { to: "/profile", labelKey: "nav.profile" }];
  }, [navItems]);

  const currentItem = useMemo(() => {
    if (location.pathname === "/") {
      return titleItems.find((item) => item.to === "/") || titleItems[0];
    }

    return (
      titleItems.find((item) => {
        return item.to !== "/" && location.pathname.startsWith(item.to);
      }) || titleItems[0]
    );
  }, [location.pathname, titleItems]);

  const isFullWidth = location.pathname.startsWith("/board");
  const appName = branding.app_name || t("app.name");
  const logoSrc = branding.app_logo_url ? `${API_BASE_URL}${branding.app_logo_url}` : appLogo;
  const poweredByLogoSrc = openArcaLogoGrey;
  const appVersion = appPackage?.version || "0.0.0";
  const userAvatarSrc = user?.avatar_filename
    ? `${API_BASE_URL}/api/auth/avatar/${user.avatar_filename}?v=${encodeURIComponent(
      user.avatar_updated_at || "1"
    )}`
    : null;

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
            <img src={logoSrc} alt={`${appName} logo`} className="sidebar-logo-image" />
            <span className="sidebar-logo-text">{appName}</span>
            <span className="sidebar-powered">Powered by OpenArca</span>
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
          <>
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

            <div className="sidebar-section">
              <p className="sidebar-section-label">{t("nav.admin")}</p>
              <NavLink
                to={adminItem.to}
                className={({ isActive }) =>
                  isActive ? "sidebar-item active" : "sidebar-item"
                }
              >
                <adminItem.icon className="sidebar-item-icon" />
                <span>{t(adminItem.labelKey)}</span>
              </NavLink>
            </div>
          </>
        ) : null}

        <div className="sidebar-footer">
          <NavLink
            to="/profile"
            className={({ isActive }) => (isActive ? "sidebar-user active" : "sidebar-user")}
          >
            <div className="sidebar-avatar">
              {userAvatarSrc ? (
                <img src={userAvatarSrc} alt={user?.name || user?.email || "User"} className="sidebar-avatar-image" />
              ) : (
                <span>{toInitials(user?.name || user?.email)}</span>
              )}
            </div>
            <div>
              <div className="text-sm">{user?.name || "User"}</div>
              <div className="text-xs muted">{user?.email}</div>
            </div>
          </NavLink>

          <button type="button" className="theme-toggle" onClick={handleToggleTheme}>
            {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
            <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
          </button>

          <button type="button" className="theme-toggle" onClick={handleLogout}>
            <LogOut size={14} />
            <span>{t("app.logout")}</span>
          </button>

          <div className="sidebar-signature">
            <a
              href={openArcaUrl}
              target="_blank"
              rel="noreferrer"
              className="sidebar-signature-link"
              aria-label="OpenArca website"
              title="OpenArca"
            >
              <img src={poweredByLogoSrc} alt="OpenArca" className="sidebar-signature-logo" />
            </a>
            <div className="sidebar-signature-meta">
              Built on OpenArca <span className="sidebar-signature-version">v{appVersion}</span>{" "}
              ·{" "}
              <a
                href={openArcaLicenseUrl}
                target="_blank"
                rel="noreferrer"
                className="sidebar-signature-license"
              >
                AGPL-3.0-only
              </a>
            </div>
          </div>
        </div>
      </aside>

      <div className="main-content">
        <header className="page-topbar">
          <div>
            <div className="page-breadcrumb">
              <span>{appName}</span>
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
                <img src={polandFlag} alt="" className="lang-flag" aria-hidden="true" />
                <span>PL</span>
              </button>
              <button
                type="button"
                className={language === "en" ? "lang-option active" : "lang-option"}
                onClick={() => handleLanguageChange("en")}
              >
                <img src={unitedStatesFlag} alt="" className="lang-flag" aria-hidden="true" />
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
