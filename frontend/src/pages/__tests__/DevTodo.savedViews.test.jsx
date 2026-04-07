import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DevTodoPage from "../DevTodo";
import * as DevTasksApi from "../../api/devTasks";
import * as TicketsApi from "../../api/tickets";
import * as AuthContext from "../../contexts/AuthContext";

vi.mock("../../api/devTasks", () => ({
  createDevTask: vi.fn(),
  deleteDevTask: vi.fn(),
  getDevTasks: vi.fn(),
  patchDevTask: vi.fn(),
  reorderDevTasks: vi.fn()
}));

vi.mock("../../api/tickets", () => ({
  addComment: vi.fn(),
  getTickets: vi.fn(),
  patchTicket: vi.fn()
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: vi.fn()
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, values) => {
      if (key === "dev.completionCommentHeader" && values?.title) {
        return `dev.completionCommentHeader:${values.title}`;
      }
      return key;
    }
  })
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <DevTodoPage />
    </MemoryRouter>
  );
}

describe("DevTodo saved views", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();

    AuthContext.useAuth.mockReturnValue({
      user: { id: "dev-1", role: "developer" }
    });

    DevTasksApi.getDevTasks.mockResolvedValue({
      active: [
        {
          id: "task-1",
          title: "Blocked payment gateway follow-up",
          description: "Blocked task",
          priority: "critical",
          status: "todo",
          estimated_hours: 2,
          planned_date: "2026-03-21",
          ticket_id: "ticket-1",
          order_index: 0
        },
        {
          id: "task-2",
          title: "In progress warehouse sync",
          description: "Active task",
          priority: "normal",
          status: "in_progress",
          estimated_hours: 3,
          planned_date: "2026-03-22",
          ticket_id: "ticket-2",
          order_index: 1
        }
      ],
      done: []
    });

    TicketsApi.getTickets.mockResolvedValue([
      {
        id: "ticket-1",
        number: 1,
        title: "Blocked payment gateway follow-up",
        project_id: "project-1",
        project_name: "Checkout Core",
        project_color: "#0f766e",
        project_icon_url: null,
        source_support_thread_id: "thread-1",
        priority: "critical",
        status: "blocked",
        assignee_id: "dev-1"
      },
      {
        id: "ticket-2",
        number: 2,
        title: "In progress warehouse sync",
        project_id: "project-2",
        project_name: "Warehouse Ops",
        project_color: "#14532d",
        project_icon_url: null,
        priority: "normal",
        status: "in_progress",
        assignee_id: "dev-1"
      },
      {
        id: "ticket-3",
        number: 3,
        title: "Waiting affiliate payout export",
        project_id: "project-3",
        project_name: "Finance Ops",
        project_color: "#166534",
        project_icon_url: null,
        priority: "high",
        status: "waiting",
        assignee_id: null
      }
    ]);
  });

  it("applies blocked quick view using linked ticket status", async () => {
    renderPage();

    expect(await screen.findByText("Blocked payment gateway follow-up")).toBeInTheDocument();
    expect(screen.getByText("In progress warehouse sync")).toBeInTheDocument();
    expect(screen.getByText(/Waiting affiliate payout export/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "tickets.quickSupportOrigin" })).toHaveAttribute(
      "href",
      "/support-threads/thread-1"
    );

    fireEvent.click(screen.getByRole("button", { name: "dev.quickViewBlocked" }));

    await waitFor(() => {
      expect(screen.getByText("Blocked payment gateway follow-up")).toBeInTheDocument();
      expect(screen.queryByText("In progress warehouse sync")).not.toBeInTheDocument();
      expect(screen.queryByText(/Waiting affiliate payout export/)).not.toBeInTheDocument();
    });
  });

  it("saves and reapplies queue-focused view", async () => {
    renderPage();

    expect(await screen.findByText("Blocked payment gateway follow-up")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("dev.ticketWorkflowFilter"), {
      target: { value: "waiting" }
    });
    fireEvent.change(screen.getByLabelText("dev.projectFilterQueue"), {
      target: { value: "project-3" }
    });
    fireEvent.change(screen.getByPlaceholderText("tickets.savedViewNamePlaceholder"), {
      target: { value: "Waiting finance queue" }
    });
    fireEvent.click(screen.getByRole("button", { name: "tickets.saveView" }));

    const persisted = JSON.parse(window.localStorage.getItem("openarca.devtodo.savedViews.v1"));
    expect(persisted.views).toHaveLength(1);
    expect(persisted.views[0].name).toBe("Waiting finance queue");
    expect(persisted.views[0].filters.ticketStatus).toBe("waiting");
    expect(persisted.views[0].filters.queueProjectId).toBe("project-3");

    fireEvent.click(screen.getByRole("button", { name: "tickets.resetFilters" }));

    await waitFor(() => {
      expect(screen.getByText("Blocked payment gateway follow-up")).toBeInTheDocument();
      expect(screen.getByText("In progress warehouse sync")).toBeInTheDocument();
      expect(screen.getByText(/Waiting affiliate payout export/)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("tickets.savedViews"), {
      target: { value: persisted.views[0].id }
    });

    await waitFor(() => {
      expect(screen.queryByText("Blocked payment gateway follow-up")).not.toBeInTheDocument();
      expect(screen.queryByText("In progress warehouse sync")).not.toBeInTheDocument();
      expect(screen.getByText(/Waiting affiliate payout export/)).toBeInTheDocument();
    });
  });
});
