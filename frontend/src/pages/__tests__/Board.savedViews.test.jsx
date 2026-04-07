import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BoardPage from "../Board";
import * as TicketsApi from "../../api/tickets";
import * as AuthContext from "../../contexts/AuthContext";

vi.mock("../../api/tickets", () => ({
  getBoard: vi.fn(),
  patchTicket: vi.fn()
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: vi.fn()
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <BoardPage />
    </MemoryRouter>
  );
}

describe("Board saved views", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    AuthContext.useAuth.mockReturnValue({
      isDeveloper: true
    });

    TicketsApi.getBoard.mockResolvedValue({
      submitted: [],
      verified: [
        {
          id: "ticket-1",
          number: 1,
          title: "Critical checkout issue",
          project_id: "project-1",
          project_name: "Core Platform",
          project_color: "#0f766e",
          project_icon_url: null,
          source_support_thread_id: "thread-1",
          category: "bug",
          priority: "critical",
          status: "verified",
          planned_date: "2026-03-18",
          description: "Critical issue"
        }
      ],
      in_progress: [],
      waiting: [
        {
          id: "ticket-2",
          number: 2,
          title: "Waiting marketplace sync",
          project_id: "project-2",
          project_name: "Marketplace Ops",
          project_color: "#14532d",
          project_icon_url: null,
          category: "feature",
          priority: "normal",
          status: "waiting",
          planned_date: "2026-03-19",
          description: "Waiting issue"
        }
      ],
      blocked: [],
      closed: []
    });
  });

  it("applies quick critical view", async () => {
    renderPage();

    expect(await screen.findByText("Critical checkout issue")).toBeInTheDocument();
    expect(screen.getByText("Waiting marketplace sync")).toBeInTheDocument();
    expect(screen.getByText("tickets.quickSupportOrigin")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "board.quickViewCritical" }));

    await waitFor(() => {
      expect(screen.getByText("Critical checkout issue")).toBeInTheDocument();
      expect(screen.queryByText("Waiting marketplace sync")).not.toBeInTheDocument();
    });
  });

  it("saves and reapplies a custom project view", async () => {
    renderPage();

    expect(await screen.findByText("Critical checkout issue")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("tickets.project"), {
      target: { value: "project-2" }
    });
    fireEvent.change(screen.getByPlaceholderText("tickets.savedViewNamePlaceholder"), {
      target: { value: "Marketplace queue" }
    });
    fireEvent.click(screen.getByRole("button", { name: "tickets.saveView" }));

    const persisted = JSON.parse(window.localStorage.getItem("openarca.board.savedViews.v1"));
    expect(persisted.views).toHaveLength(1);
    expect(persisted.views[0].name).toBe("Marketplace queue");
    expect(persisted.views[0].filters.projectId).toBe("project-2");

    fireEvent.click(screen.getByRole("button", { name: "tickets.resetFilters" }));

    await waitFor(() => {
      expect(screen.getByText("Critical checkout issue")).toBeInTheDocument();
      expect(screen.getByText("Waiting marketplace sync")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("tickets.savedViews"), {
      target: { value: persisted.views[0].id }
    });

    await waitFor(() => {
      expect(screen.queryByText("Critical checkout issue")).not.toBeInTheDocument();
      expect(screen.getByText("Waiting marketplace sync")).toBeInTheDocument();
    });
  });

  it("shows developer support thread link in preview", async () => {
    renderPage();

    const titleButtons = await screen.findAllByRole("button", { name: /critical checkout issue/i });
    fireEvent.click(titleButtons.find((element) => element.tagName === "BUTTON"));

    expect(await screen.findByRole("link", { name: "tickets.quickSupportOrigin" })).toHaveAttribute(
      "href",
      "/support-threads/thread-1"
    );
  });
});
