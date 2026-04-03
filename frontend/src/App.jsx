import { Fragment } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import DeveloperRoute from "./components/DeveloperRoute";
import FeatureRoute from "./components/FeatureRoute";
import LoadingScreen from "./components/LoadingScreen";
import AppShell from "./components/AppShell";
import LoginPage from "./pages/Login";
import DashboardPage from "./pages/Dashboard";
import NewTicketPage from "./pages/NewTicket";
import MyTicketsPage from "./pages/MyTickets";
import ProfilePage from "./pages/Profile";
import TicketDetailPage from "./pages/TicketDetail";
import OverviewPage from "./pages/Overview";
import BoardPage from "./pages/Board";
import DevTodoPage from "./pages/DevTodo";
import AdminPage from "./pages/Admin";
import NotFoundPage from "./pages/NotFound";
import { enterpriseRoutes } from "virtual:enterprise-frontend";

function LoginRoute() {
  const { ready, isAuthenticated } = useAuth();

  if (!ready) {
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <LoginPage />;
}

export default function App() {
  function renderEnterpriseRoute(route) {
    const Component = route.component;
    const leaf = <Route path={route.path} element={<Component />} />;
    const withFeature = route.featureKey ? (
      <Route
        element={<FeatureRoute featureKey={route.featureKey} fallbackTo={route.fallbackTo || "/"} />}
      >
        {leaf}
      </Route>
    ) : (
      leaf
    );

    const wrapped = route.requiresDeveloper ? (
      <Route element={<DeveloperRoute />}>{withFeature}</Route>
    ) : (
      withFeature
    );

    return <Fragment key={route.path}>{wrapped}</Fragment>;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="/new-ticket" element={<NewTicketPage />} />
          <Route path="/my-tickets" element={<MyTicketsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/ticket/:id" element={<TicketDetailPage />} />
          <Route path="/overview" element={<OverviewPage />} />

          <Route element={<DeveloperRoute />}>
            <Route path="/board" element={<BoardPage />} />
            <Route path="/dev-todo" element={<DevTodoPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>

          {enterpriseRoutes.map(renderEnterpriseRoute)}
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
