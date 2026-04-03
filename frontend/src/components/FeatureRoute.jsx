import { Navigate, Outlet } from "react-router-dom";
import { useCapabilities } from "../contexts/CapabilitiesContext";
import LoadingScreen from "./LoadingScreen";

export default function FeatureRoute({ featureKey, fallbackTo = "/" }) {
  const { ready, hasFeature } = useCapabilities();

  if (!ready) {
    return <LoadingScreen />;
  }

  if (featureKey && !hasFeature(featureKey)) {
    return <Navigate to={fallbackTo} replace />;
  }

  return <Outlet />;
}
