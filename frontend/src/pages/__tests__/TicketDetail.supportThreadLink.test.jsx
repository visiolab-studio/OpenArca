import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TicketDetailPage from "../TicketDetail";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    isDeveloper: false,
    token: "test-token"
  })
}));

vi.mock("../../api/users", () => ({
  getUsers: vi.fn()
}));

vi.mock("../../api/tickets", () => ({
  addExternalReference: vi.fn(),
  addRelatedTicket: vi.fn(),
  addAttachments: vi.fn(),
  addComment: vi.fn(),
  deleteExternalReference: vi.fn(),
  deleteRelatedTicket: vi.fn(),
  getTicket: vi.fn(),
  patchTicket: vi.fn()
}));

import { getTicket } from "../../api/tickets";

describe("TicketDetailPage support thread backlink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTicket.mockResolvedValue({
      id: "ticket-1",
      number: 17,
      title: "Converted support thread ticket",
      description: "Converted support thread description.",
      status: "verified",
      priority: "high",
      category: "question",
      assignee_id: null,
      planned_date: null,
      estimated_hours: null,
      internal_note: "",
      created_at: "2026-04-03T09:00:00.000Z",
      updated_at: "2026-04-03T10:00:00.000Z",
      source_support_thread_id: "thread-123",
      project_name: "Marketplace Core",
      project_color: "#0f7a5a",
      project_icon_url: null,
      attachments: [],
      comments: [],
      history: [],
      related_tickets: [],
      external_references: []
    });
  });

  it("renders a link back to the source support thread", async () => {
    render(
      <MemoryRouter initialEntries={["/ticket/ticket-1"]}>
        <Routes>
          <Route path="/ticket/:id" element={<TicketDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getTicket).toHaveBeenCalledWith("ticket-1");
    });

    expect(await screen.findByRole("link", { name: "tickets.openSourceSupportThread" })).toHaveAttribute(
      "href",
      "/quick-support/thread-123"
    );
    expect(screen.getByText("tickets.sourceSupportThread")).toBeInTheDocument();
    expect(screen.getByText("Converted support thread ticket")).toBeInTheDocument();
  });
});
