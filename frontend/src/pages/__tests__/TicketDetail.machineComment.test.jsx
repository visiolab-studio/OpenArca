import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TicketDetailPage from "../TicketDetail";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key, options) => {
      if (key === "tickets.machineActingFor" && options?.owner) {
        return `machineActingFor:${options.owner}`;
      }
      // Rendered verbatim so the test pins the FORMAT, not just the key.
      if (key === "tickets.machineAuthor" && options?.owner) {
        return `Agent (${options.owner})`;
      }
      return key;
    }
  }),
  // Strony siegaja po jezyk interfejsu (kategorie sa tlumaczone), a to ciagnie
  // modul i18n, ktory inicjalizuje sie tym pluginem.
  initReactI18next: { type: "3rdParty", init: () => {} }
}));

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({
    isDeveloper: true,
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
import { getUsers } from "../../api/users";

describe("TicketDetailPage machine-authored and draft comments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUsers.mockResolvedValue([]);
    getTicket.mockResolvedValue({
      id: "ticket-1",
      number: 42,
      title: "Ticket with an agent-drafted reply",
      description: "Description.",
      status: "in_progress",
      priority: "normal",
      category: "other",
      assignee_id: null,
      planned_date: null,
      estimated_hours: null,
      internal_note: "",
      created_at: "2026-04-03T09:00:00.000Z",
      updated_at: "2026-04-03T10:00:00.000Z",
      source_support_thread_id: null,
      project_name: "Marketplace Core",
      project_color: "#0f7a5a",
      project_icon_url: null,
      attachments: [],
      history: [],
      related_tickets: [],
      external_references: [],
      comments: [
        {
          id: "comment-1",
          user_name: "Jane Owner",
          user_email: "jane@example.com",
          content: "This is a machine-drafted analysis.",
          is_developer: 1,
          is_internal: 0,
          is_closure_summary: 0,
          author_kind: "machine",
          is_unpublished: true,
          type: "comment",
          created_at: "2026-04-03T09:30:00.000Z"
        },
        {
          id: "comment-2",
          user_name: "John Human",
          user_email: "john@example.com",
          content: "A regular human reply.",
          is_developer: 1,
          is_internal: 0,
          is_closure_summary: 0,
          author_kind: "human",
          is_unpublished: false,
          type: "comment",
          created_at: "2026-04-03T09:45:00.000Z"
        }
      ]
    });
  });

  it("renders a machine marker and a draft marker for an unpublished machine comment", async () => {
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

    // "Agent (owner)", not the machine account's own name: a name like
    // "MacBook Agents AI" tells a reader nothing, while the owner is who
    // answers for the analysis.
    // findAll, not find: the Enterprise layer's findings section renders the
    // same label for the same comment, which is the consistency we want.
    const labels = await screen.findAllByText("Agent (Jane Owner)");
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.some((node) => node.className.includes("comment-author"))).toBe(true);

    // The machine marker (avatar label) must be present without hovering.
    expect(screen.getByText("tickets.machineAvatar")).toBeInTheDocument();
    // The label names the agent and the human owner it acted for.
    expect(screen.getByText("machineActingFor:Jane Owner")).toBeInTheDocument();
    // The unpublished comment carries a visible draft marker.
    expect(screen.getByText("tickets.commentDraft")).toBeInTheDocument();

    // The layer's findings section shows the same text, so scope to the comment
    // thread item rather than matching the string globally.
    const machineComment = screen
      .getAllByText("This is a machine-drafted analysis.")
      .map((node) => node.closest("li"))
      .find(Boolean);
    expect(machineComment).toHaveClass("machine");
    expect(machineComment).toHaveClass("draft");

    // The regular human, published comment must NOT carry either marker.
    const humanComment = screen.getByText("A regular human reply.").closest("li");
    expect(humanComment).not.toHaveClass("machine");
    expect(humanComment).not.toHaveClass("draft");
  });
});
