import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MyTicketsPage from "../MyTickets";
import * as TicketsApi from "../../api/tickets";
import * as ProjectsApi from "../../api/projects";

vi.mock("../../api/tickets", () => ({
  getTickets: vi.fn()
}));

vi.mock("../../api/projects", () => ({
  getProjects: vi.fn()
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <MyTicketsPage />
    </MemoryRouter>
  );
}

describe("MyTickets saved views", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();

    ProjectsApi.getProjects.mockResolvedValue([
      { id: "project-1", name: "Core Platform", color: "#0f766e", icon_url: null }
    ]);

    TicketsApi.getTickets.mockResolvedValue([
      {
        id: "ticket-1",
        number: 1,
        title: "Critical checkout issue",
        project_id: "project-1",
        project_name: "Core Platform",
        project_color: "#0f766e",
        project_icon_url: null,
        category: "bug",
        priority: "critical",
        status: "waiting",
        created_at: "2026-03-17T12:00:00.000Z",
        updated_at: "2026-03-17T14:00:00.000Z",
        planned_date: "2026-03-18"
      },
      {
        id: "ticket-2",
        number: 2,
        title: "Normal reporting request",
        project_id: "project-1",
        project_name: "Core Platform",
        project_color: "#0f766e",
        project_icon_url: null,
        category: "feature",
        priority: "normal",
        status: "blocked",
        created_at: "2026-03-10T09:00:00.000Z",
        updated_at: "2026-03-10T10:00:00.000Z",
        planned_date: null
      }
    ]);
  });

  it("applies quick critical view", async () => {
    renderPage();

    expect(await screen.findByText("Critical checkout issue")).toBeInTheDocument();
    expect(screen.getByText("Normal reporting request")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "tickets.quickViewCritical" }));

    await waitFor(() => {
      expect(screen.getByText("Critical checkout issue")).toBeInTheDocument();
      expect(screen.queryByText("Normal reporting request")).not.toBeInTheDocument();
    });
  });

  it("saves and reapplies a custom view", async () => {
    renderPage();

    expect(await screen.findByText("Critical checkout issue")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("tickets.priority"), {
      target: { value: "critical" }
    });
    fireEvent.change(screen.getByPlaceholderText("tickets.savedViewNamePlaceholder"), {
      target: { value: "Critical only" }
    });
    fireEvent.click(screen.getByRole("button", { name: "tickets.saveView" }));

    const persisted = JSON.parse(window.localStorage.getItem("openarca.myTickets.savedViews.v1"));
    expect(persisted.views).toHaveLength(1);
    expect(persisted.views[0].name).toBe("Critical only");
    expect(persisted.views[0].filters.priority).toBe("critical");

    fireEvent.click(screen.getByRole("button", { name: "tickets.resetFilters" }));

    await waitFor(() => {
      expect(screen.getByText("Critical checkout issue")).toBeInTheDocument();
      expect(screen.getByText("Normal reporting request")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("tickets.savedViews"), {
      target: { value: persisted.views[0].id }
    });

    await waitFor(() => {
      expect(screen.getByText("Critical checkout issue")).toBeInTheDocument();
      expect(screen.queryByText("Normal reporting request")).not.toBeInTheDocument();
    });
  });
});
