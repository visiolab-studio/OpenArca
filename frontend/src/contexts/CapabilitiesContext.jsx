import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getCapabilities as getCapabilitiesApi } from "../api/settings";
import { useAuth } from "./AuthContext";

const DEFAULT_CAPABILITIES = Object.freeze({
  core_tickets: true,
  core_board: true,
  core_devtodo: true,
  core_admin: true,
  enterprise_automation: false,
  enterprise_sso_google: false,
  enterprise_sso_microsoft: false,
  enterprise_sso_saml: false,
  enterprise_audit_immutable: false,
  enterprise_audit_export: false,
  enterprise_data_retention: false,
  enterprise_custom_workflows: false,
  enterprise_multi_team: false,
  enterprise_ai_recall: false
});

const CapabilitiesContext = createContext(null);

export function CapabilitiesProvider({ children }) {
  const { ready: authReady, isAuthenticated } = useAuth();
  const [ready, setReady] = useState(false);
  const [edition, setEdition] = useState("open_core");
  const [capabilities, setCapabilities] = useState(DEFAULT_CAPABILITIES);

  const refreshCapabilities = useCallback(async () => {
    const payload = await getCapabilitiesApi();
    setEdition(payload?.edition || "open_core");
    setCapabilities((current) => ({
      ...current,
      ...(payload?.capabilities || {})
    }));
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!authReady) {
        return;
      }

      if (!isAuthenticated) {
        if (active) {
          setEdition("open_core");
          setCapabilities(DEFAULT_CAPABILITIES);
          setReady(true);
        }
        return;
      }

      try {
        await refreshCapabilities();
      } catch (_error) {
        if (active) {
          setEdition("open_core");
          setCapabilities(DEFAULT_CAPABILITIES);
        }
      } finally {
        if (active) {
          setReady(true);
        }
      }
    }

    setReady(false);
    bootstrap();

    return () => {
      active = false;
    };
  }, [authReady, isAuthenticated, refreshCapabilities]);

  const value = useMemo(
    () => ({
      ready,
      edition,
      capabilities,
      hasFeature: (flag) => Boolean(capabilities?.[flag]),
      refreshCapabilities
    }),
    [ready, edition, capabilities, refreshCapabilities]
  );

  return <CapabilitiesContext.Provider value={value}>{children}</CapabilitiesContext.Provider>;
}

export function useCapabilities() {
  const context = useContext(CapabilitiesContext);
  if (!context) {
    throw new Error("useCapabilities must be used within CapabilitiesProvider");
  }
  return context;
}
