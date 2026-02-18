import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function DeveloperRoute() {
  const { isDeveloper } = useAuth();

  if (!isDeveloper) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
