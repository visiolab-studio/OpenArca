import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ProtectedRoute from "../ProtectedRoute";
import DeveloperRoute from "../DeveloperRoute";
import * as AuthContext from "../../contexts/AuthContext";

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: vi.fn()
}));

vi.mock("../LoadingScreen", () => ({
  default: () => <div>loading-screen</div>
}));

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={["/private"]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/private" element={<div>private-content</div>} />
        </Route>
        <Route path="/login" element={<div>login-page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function renderDeveloperRoute() {
  return render(
    <MemoryRouter initialEntries={["/board"]}>
      <Routes>
        <Route element={<DeveloperRoute />}>
          <Route path="/board" element={<div>developer-board</div>} />
        </Route>
        <Route path="/" element={<div>dashboard-home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("route guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state before auth bootstrap", () => {
    AuthContext.useAuth.mockReturnValue({ ready: false, isAuthenticated: false, isDeveloper: false });

    renderProtected();

    expect(screen.getByText("loading-screen")).toBeInTheDocument();
  });

  it("redirects unauthenticated user to login", () => {
    AuthContext.useAuth.mockReturnValue({ ready: true, isAuthenticated: false, isDeveloper: false });

    renderProtected();

    expect(screen.getByText("login-page")).toBeInTheDocument();
    expect(screen.queryByText("private-content")).not.toBeInTheDocument();
  });

  it("allows authenticated user to access protected route", () => {
    AuthContext.useAuth.mockReturnValue({ ready: true, isAuthenticated: true, isDeveloper: false });

    renderProtected();

    expect(screen.getByText("private-content")).toBeInTheDocument();
  });

  it("redirects non-developer away from developer routes", () => {
    AuthContext.useAuth.mockReturnValue({ ready: true, isAuthenticated: true, isDeveloper: false });

    renderDeveloperRoute();

    expect(screen.getByText("dashboard-home")).toBeInTheDocument();
    expect(screen.queryByText("developer-board")).not.toBeInTheDocument();
  });

  it("allows developer to access developer routes", () => {
    AuthContext.useAuth.mockReturnValue({ ready: true, isAuthenticated: true, isDeveloper: true });

    renderDeveloperRoute();

    expect(screen.getByText("developer-board")).toBeInTheDocument();
  });
});
