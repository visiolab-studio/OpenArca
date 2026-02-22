import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppShell from "../AppShell";
import * as AuthContext from "../../contexts/AuthContext";
import * as LanguageContext from "../../contexts/LanguageContext";
import * as SettingsApi from "../../api/settings";

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: vi.fn()
}));

vi.mock("../../contexts/LanguageContext", () => ({
  useLanguage: vi.fn()
}));

vi.mock("../../api/settings", () => ({
  getPublicSettings: vi.fn()
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}));

function renderShell() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<div>dashboard-content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("AppShell role-based navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    SettingsApi.getPublicSettings.mockResolvedValue({});
    LanguageContext.useLanguage.mockReturnValue({
      language: "pl",
      setLanguage: vi.fn()
    });
  });

  it("hides developer links for standard user", async () => {
    AuthContext.useAuth.mockReturnValue({
      user: { email: "user@example.com", language: "pl", role: "user" },
      isDeveloper: false,
      logout: vi.fn(),
      updateProfile: vi.fn()
    });

    renderShell();
    await waitFor(() => {
      expect(SettingsApi.getPublicSettings).toHaveBeenCalledTimes(1);
    });

    expect(screen.getAllByText("nav.dashboard").length).toBeGreaterThan(0);
    expect(screen.queryByText("nav.board")).not.toBeInTheDocument();
    expect(screen.queryByText("nav.todo")).not.toBeInTheDocument();
    expect(screen.queryByText("nav.admin")).not.toBeInTheDocument();
  });

  it("shows developer links for developer role", async () => {
    AuthContext.useAuth.mockReturnValue({
      user: { email: "dev@example.com", language: "pl", role: "developer" },
      isDeveloper: true,
      logout: vi.fn(),
      updateProfile: vi.fn()
    });

    renderShell();
    await waitFor(() => {
      expect(SettingsApi.getPublicSettings).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("nav.board")).toBeInTheDocument();
    expect(screen.getByText("nav.todo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "nav.admin" })).toBeInTheDocument();
  });
});
