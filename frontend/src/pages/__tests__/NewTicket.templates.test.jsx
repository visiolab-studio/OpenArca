import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewTicketPage from "../NewTicket";
import * as ProjectsApi from "../../api/projects";
import * as TicketTemplatesApi from "../../api/ticketTemplates";

vi.mock("../../api/projects", () => ({
  getProjects: vi.fn()
}));

vi.mock("../../api/ticketTemplates", () => ({
  getTicketTemplates: vi.fn()
}));

vi.mock("../../api/tickets", () => ({
  createTicket: vi.fn()
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <NewTicketPage />
    </MemoryRouter>
  );
}

describe("NewTicket templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    ProjectsApi.getProjects.mockResolvedValue([
      { id: "project-1", name: "Checkout Core", color: "#0F766E", icon_url: null }
    ]);

    TicketTemplatesApi.getTicketTemplates.mockImplementation(({ projectId } = {}) => {
      if (projectId === "project-1") {
        return Promise.resolve([
          {
            id: "template-project",
            name: "Checkout bug",
            project_id: "project-1",
            project_name: "Checkout Core",
            category: "feature",
            urgency_reporter: "high",
            title_template: "Checkout flow needs fallback message",
            description_template:
              "Customers lose context when the checkout response fails after payment step.",
            checklist_items: ["Capture order ID", "Attach payment provider timestamp"],
            is_active: true
          },
          {
            id: "template-global",
            name: "Global support intake",
            project_id: null,
            project_name: null,
            category: "question",
            urgency_reporter: "normal",
            title_template: "Global ticket title",
            description_template: "Global ticket description for generic intake.",
            checklist_items: ["Describe the issue"],
            is_active: true
          }
        ]);
      }

      return Promise.resolve([
        {
          id: "template-global",
          name: "Global support intake",
          project_id: null,
          project_name: null,
          category: "question",
          urgency_reporter: "normal",
          title_template: "Global ticket title",
          description_template: "Global ticket description for generic intake.",
          checklist_items: ["Describe the issue"],
          is_active: true
        }
      ]);
    });
  });

  it("loads project templates with global fallback and prefills the form", async () => {
    renderPage();

    const templateSelect = await screen.findByLabelText("newTicket.templateLabel");
    expect(screen.getByRole("option", { name: /Global support intake/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Checkout bug/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("tickets.project"), {
      target: { value: "project-1" }
    });

    await waitFor(() => {
      expect(TicketTemplatesApi.getTicketTemplates).toHaveBeenLastCalledWith({ projectId: "project-1" });
    });

    await waitFor(() => {
      expect(screen.getByRole("option", { name: /Checkout bug/ })).toBeInTheDocument();
    });

    fireEvent.change(templateSelect, {
      target: { value: "template-project" }
    });

    expect(screen.getByLabelText("tickets.titleField")).toHaveValue(
      "Checkout flow needs fallback message"
    );
    expect(screen.getByRole("button", { name: /category.feature/ })).toHaveClass("selected");

    fireEvent.click(screen.getByRole("button", { name: "app.next" }));

    const descriptionField = screen.getByLabelText("tickets.description");
    expect(descriptionField.value).toContain(
      "Customers lose context when the checkout response fails after payment step."
    );
    expect(descriptionField.value).toContain("- Capture order ID");

    fireEvent.click(screen.getByRole("button", { name: "app.next" }));

    expect(screen.getByLabelText("tickets.urgency")).toHaveValue("high");
  });
});
