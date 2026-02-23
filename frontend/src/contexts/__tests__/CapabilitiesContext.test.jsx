import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CapabilitiesProvider, useCapabilities } from "../CapabilitiesContext";
import * as AuthContext from "../AuthContext";
import * as SettingsApi from "../../api/settings";

vi.mock("../AuthContext", () => ({
  useAuth: vi.fn()
}));

vi.mock("../../api/settings", () => ({
  getCapabilities: vi.fn()
}));

function CapabilitiesProbe() {
  const { ready, edition, hasFeature } = useCapabilities();

  return (
    <div>
      <span data-testid="ready">{String(ready)}</span>
      <span data-testid="edition">{edition}</span>
      <span data-testid="enterprise-automation">{String(hasFeature("enterprise_automation"))}</span>
      <span data-testid="core-admin">{String(hasFeature("core_admin"))}</span>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <CapabilitiesProvider>
      <CapabilitiesProbe />
    </CapabilitiesProvider>
  );
}

describe("CapabilitiesProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps open-core defaults for unauthenticated user", async () => {
    AuthContext.useAuth.mockReturnValue({
      ready: true,
      isAuthenticated: false
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("ready")).toHaveTextContent("true");
    });

    expect(SettingsApi.getCapabilities).not.toHaveBeenCalled();
    expect(screen.getByTestId("edition")).toHaveTextContent("open_core");
    expect(screen.getByTestId("enterprise-automation")).toHaveTextContent("false");
    expect(screen.getByTestId("core-admin")).toHaveTextContent("true");
  });

  it("loads capabilities for authenticated user", async () => {
    AuthContext.useAuth.mockReturnValue({
      ready: true,
      isAuthenticated: true
    });
    SettingsApi.getCapabilities.mockResolvedValue({
      edition: "enterprise",
      capabilities: {
        enterprise_automation: true,
        core_admin: false
      }
    });

    renderWithProvider();

    await waitFor(() => {
      expect(SettingsApi.getCapabilities).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("ready")).toHaveTextContent("true");
    });

    expect(screen.getByTestId("edition")).toHaveTextContent("enterprise");
    expect(screen.getByTestId("enterprise-automation")).toHaveTextContent("true");
    expect(screen.getByTestId("core-admin")).toHaveTextContent("false");
  });

  it("falls back to defaults when capabilities request fails", async () => {
    AuthContext.useAuth.mockReturnValue({
      ready: true,
      isAuthenticated: true
    });
    SettingsApi.getCapabilities.mockRejectedValue(new Error("network"));

    renderWithProvider();

    await waitFor(() => {
      expect(SettingsApi.getCapabilities).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("ready")).toHaveTextContent("true");
    });

    expect(screen.getByTestId("edition")).toHaveTextContent("open_core");
    expect(screen.getByTestId("enterprise-automation")).toHaveTextContent("false");
    expect(screen.getByTestId("core-admin")).toHaveTextContent("true");
  });
});
