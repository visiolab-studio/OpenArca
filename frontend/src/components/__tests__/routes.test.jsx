import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import ProtectedRoute from "../ProtectedRoute";
import DeveloperRoute from "../DeveloperRoute";
import FeatureRoute from "../FeatureRoute";
import StandardUserRoute from "../StandardUserRoute";
import * as AuthContext from "../../contexts/AuthContext";
import * as CapabilitiesContext from "../../contexts/CapabilitiesContext";

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: vi.fn()
}));

vi.mock("../../contexts/CapabilitiesContext", () => ({
  useCapabilities: vi.fn()
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

function renderFeatureRoute() {
  return render(
    <MemoryRouter initialEntries={["/support-threads"]}>
      <Routes>
        <Route element={<FeatureRoute featureKey="enterprise_support_threads" />}>
          <Route path="/support-threads" element={<div>support-threads-page</div>} />
        </Route>
        <Route path="/" element={<div>dashboard-home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function renderStandardUserRoute() {
  return render(
    <MemoryRouter initialEntries={["/quick-support"]}>
      <Routes>
        <Route element={<StandardUserRoute />}>
          <Route path="/quick-support" element={<div>quick-support-page</div>} />
        </Route>
        <Route path="/" element={<div>dashboard-home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("route guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    CapabilitiesContext.useCapabilities.mockReturnValue({
      ready: true,
      hasFeature: () => false
    });
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

  it("redirects developer away from standard-user routes", () => {
    AuthContext.useAuth.mockReturnValue({ ready: true, isAuthenticated: true, isDeveloper: true });

    renderStandardUserRoute();

    expect(screen.getByText("dashboard-home")).toBeInTheDocument();
    expect(screen.queryByText("quick-support-page")).not.toBeInTheDocument();
  });

  it("allows standard user to access standard-user routes", () => {
    AuthContext.useAuth.mockReturnValue({ ready: true, isAuthenticated: true, isDeveloper: false });

    renderStandardUserRoute();

    expect(screen.getByText("quick-support-page")).toBeInTheDocument();
  });

  it("redirects when feature flag is disabled", () => {
    renderFeatureRoute();

    expect(screen.getByText("dashboard-home")).toBeInTheDocument();
    expect(screen.queryByText("support-threads-page")).not.toBeInTheDocument();
  });

  it("allows feature route when capability is enabled", () => {
    CapabilitiesContext.useCapabilities.mockReturnValue({
      ready: true,
      hasFeature: (flag) => flag === "enterprise_support_threads"
    });

    renderFeatureRoute();

    expect(screen.getByText("support-threads-page")).toBeInTheDocument();
  });
});
