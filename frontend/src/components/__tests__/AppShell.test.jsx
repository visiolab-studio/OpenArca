import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppShell from "../AppShell";
import * as AuthContext from "../../contexts/AuthContext";
import * as LanguageContext from "../../contexts/LanguageContext";

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: vi.fn()
}));

vi.mock("../../contexts/LanguageContext", () => ({
  useLanguage: vi.fn()
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
    LanguageContext.useLanguage.mockReturnValue({
      language: "pl",
      setLanguage: vi.fn()
    });
  });

  it("hides developer links for standard user", () => {
    AuthContext.useAuth.mockReturnValue({
      user: { email: "user@example.com", language: "pl", role: "user" },
      isDeveloper: false,
      logout: vi.fn(),
      updateProfile: vi.fn()
    });

    renderShell();

    expect(screen.getByText("nav.dashboard")).toBeInTheDocument();
    expect(screen.queryByText("nav.board")).not.toBeInTheDocument();
    expect(screen.queryByText("nav.todo")).not.toBeInTheDocument();
    expect(screen.queryByText("nav.admin")).not.toBeInTheDocument();
  });

  it("shows developer links for developer role", () => {
    AuthContext.useAuth.mockReturnValue({
      user: { email: "dev@example.com", language: "pl", role: "developer" },
      isDeveloper: true,
      logout: vi.fn(),
      updateProfile: vi.fn()
    });

    renderShell();

    expect(screen.getByText("nav.board")).toBeInTheDocument();
    expect(screen.getByText("nav.todo")).toBeInTheDocument();
    expect(screen.getByText("nav.admin")).toBeInTheDocument();
  });
});
