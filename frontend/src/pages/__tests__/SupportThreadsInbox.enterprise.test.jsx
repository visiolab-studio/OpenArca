import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupportThreadDetailPage, SupportThreadsInboxPage } from "virtual:enterprise-frontend";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "pl" }
  })
}));

describe("SupportThreadsInboxPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn(async (input) => {
      const url = String(input);
      const search = new URL(url).searchParams;
      const status = search.get("status");
      const scope = search.get("scope");
      const q = search.get("q");

      const items = [
        {
          id: "thread-1",
          title: "Quick question about hero image size",
          status: "open",
          priority: "normal",
          assignee_id: null,
          requester: { email: "ava@ecommerce-arca.com" },
          assignee: null,
          message_count: 1,
          updated_at: "2026-04-03T10:00:00.000Z",
          latest_message_preview: "What exact size should we use?",
          has_attachments: false
        },
        {
          id: "thread-2",
          title: "Order export clarification",
          status: "pending",
          priority: "high",
          assignee_id: "dev-1",
          requester: { email: "ethan@ecommerce-arca.com" },
          assignee: { email: "emma.wright@ecommerce-arca.com" },
          message_count: 3,
          updated_at: "2026-04-03T11:00:00.000Z",
          latest_message_preview: "Waiting for exporter logs.",
          has_attachments: true
        }
      ].filter((item) => {
        if (status && item.status !== status) return false;
        if (scope === "unassigned" && item.assignee_id) return false;
        if (scope === "mine" && item.assignee_id !== "dev-1") return false;
        if (q && !item.title.toLowerCase().includes(q.toLowerCase())) return false;
        return true;
      });

      return {
        ok: true,
        json: async () => items
      };
    });
  });

  it("renders inbox summary and filters list by status and scope", async () => {
    render(
      <MemoryRouter>
        <SupportThreadsInboxPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Quick question about hero image size")).toBeInTheDocument();
    expect(screen.getByText("Order export clarification")).toBeInTheDocument();
    expect(screen.getByText("Widoczne wątki")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "pending" }
    });

    await waitFor(() => {
      expect(screen.queryByText("Quick question about hero image size")).not.toBeInTheDocument();
      expect(screen.getByText("Order export clarification")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Zakres"), {
      target: { value: "unassigned" }
    });

    await waitFor(() => {
      expect(screen.getByText("Brak wątków supportowych dla wybranych filtrów.")).toBeInTheDocument();
    });
  });

  it("filters list by search phrase", async () => {
    render(
      <MemoryRouter>
        <SupportThreadsInboxPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Quick question about hero image size")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Szukaj po tytule, zgłaszającym lub treści wiadomości"), {
      target: { value: "hero image" }
    });

    await waitFor(() => {
      expect(screen.getByText("Quick question about hero image size")).toBeInTheDocument();
      expect(screen.queryByText("Order export clarification")).not.toBeInTheDocument();
    });
  });

  it("opens thread detail from clickable title", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: "thread-1",
            title: "Quick question about hero image size",
            status: "open",
            priority: "normal",
            assignee_id: null,
            requester: { email: "ava@ecommerce-arca.com" },
            assignee: null,
            message_count: 1,
            updated_at: "2026-04-03T10:00:00.000Z",
            latest_message_preview: "What exact size should we use?",
            has_attachments: false
          }
        ]
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "thread-1",
          title: "Quick question about hero image size",
          status: "open",
          priority: "normal",
          project: { name: "Marketplace Core" },
          requester: { email: "ava@ecommerce-arca.com" },
          assignee: null,
          created_at: "2026-04-03T09:00:00.000Z",
          updated_at: "2026-04-03T10:00:00.000Z",
          messages: [
            {
              id: "message-1",
              content: "What exact size should we use?",
              created_at: "2026-04-03T09:00:00.000Z",
              author: { email: "ava@ecommerce-arca.com", role: "user" },
              attachments: []
            }
          ]
        })
      });

    render(
      <MemoryRouter initialEntries={["/support-threads"]}>
        <Routes>
          <Route path="/support-threads" element={<SupportThreadsInboxPage />} />
          <Route path="/support-threads/:id" element={<SupportThreadDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("link", { name: /quick question about hero image size/i }));

    expect(await screen.findByText("Konwersacja")).toBeInTheDocument();
    expect(screen.getByText("Marketplace Core", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("What exact size should we use?")).toBeInTheDocument();
  });
});
