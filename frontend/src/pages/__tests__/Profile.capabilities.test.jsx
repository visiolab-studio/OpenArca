import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "../Profile";
import * as AuthContext from "../../contexts/AuthContext";
import * as CapabilitiesContext from "../../contexts/CapabilitiesContext";

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: vi.fn()
}));

vi.mock("../../contexts/CapabilitiesContext", () => ({
  useCapabilities: vi.fn()
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, options) => {
      if (key === "profile.flagsCount") return `Flags: ${options?.count ?? 0}`;
      return key;
    }
  })
}));

describe("Profile capabilities modal", () => {
  let refreshCapabilitiesMock;

  beforeEach(() => {
    vi.clearAllMocks();
    refreshCapabilitiesMock = vi.fn().mockResolvedValue(undefined);
    AuthContext.useAuth.mockReturnValue({
      user: { email: "user@example.com", name: "User Name" },
      updateProfile: vi.fn().mockResolvedValue(undefined),
      uploadAvatar: vi.fn().mockResolvedValue(undefined)
    });
    CapabilitiesContext.useCapabilities.mockReturnValue({
      ready: true,
      edition: "open_core",
      capabilities: {
        core_tickets: true,
        enterprise_automation: false
      },
      refreshCapabilities: refreshCapabilitiesMock
    });
  });

  it("opens capabilities modal and triggers refresh", () => {
    render(<ProfilePage />);

    fireEvent.click(screen.getByRole("button", { name: "profile.showCapabilities" }));

    expect(screen.getByText("profile.capabilitiesTitle")).toBeInTheDocument();
    expect(screen.getByText("profile.editionLabel: open_core")).toBeInTheDocument();
    expect(screen.getByText("Flags: 2")).toBeInTheDocument();
    expect(screen.getByText("core_tickets")).toBeInTheDocument();
    expect(screen.getByText("enterprise_automation")).toBeInTheDocument();
    expect(refreshCapabilitiesMock).toHaveBeenCalledTimes(1);
  });
});
