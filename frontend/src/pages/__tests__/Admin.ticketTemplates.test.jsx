import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminPage from "../Admin";
import * as ProjectsApi from "../../api/projects";
import * as SettingsApi from "../../api/settings";
import * as TicketTemplatesApi from "../../api/ticketTemplates";
import * as UsersApi from "../../api/users";

vi.mock("../../api/projects", () => ({
  createProject: vi.fn(),
  deleteProject: vi.fn(),
  deleteProjectIcon: vi.fn(),
  getProjects: vi.fn(),
  patchProject: vi.fn(),
  uploadProjectIcon: vi.fn()
}));

vi.mock("../../api/settings", () => ({
  getSettings: vi.fn(),
  patchSettings: vi.fn(),
  testEmail: vi.fn(),
  uploadAppLogo: vi.fn()
}));

vi.mock("../../api/ticketTemplates", () => ({
  createTicketTemplate: vi.fn(),
  deleteTicketTemplate: vi.fn(),
  getTicketTemplates: vi.fn(),
  patchTicketTemplate: vi.fn()
}));

vi.mock("../../api/users", () => ({
  getUsers: vi.fn(),
  patchUser: vi.fn()
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}));

describe("Admin ticket templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    SettingsApi.getSettings.mockResolvedValue({
      app_name: "OpenArca",
      app_url: "http://localhost:3330",
      allowed_domains: ["example.com"],
      developer_emails: ["dev@example.com"],
      app_logo_url: null,
      mail_provider: "smtp",
      smtp_host: "",
      smtp_port: "587",
      smtp_user: "",
      smtp_pass: "",
      smtp_from: "",
      ses_region: "",
      ses_from: "",
      ses_access_key_id: "",
      ses_secret_access_key: "",
      ses_session_token: "",
      ses_endpoint: ""
    });

    ProjectsApi.getProjects.mockResolvedValue([
      { id: "project-1", name: "Checkout Core", description: "Checkout", color: "#0F766E", icon_url: null }
    ]);

    TicketTemplatesApi.getTicketTemplates.mockResolvedValue([
      {
        id: "template-1",
        name: "Existing checkout template",
        project_id: "project-1",
        project_name: "Checkout Core",
        category: "bug",
        urgency_reporter: "high",
        title_template: "Checkout bug title",
        description_template: "Checkout bug description",
        checklist_items: ["Collect error message"],
        is_active: true
      }
    ]);

    UsersApi.getUsers.mockResolvedValue([]);

    TicketTemplatesApi.createTicketTemplate.mockResolvedValue({
      id: "template-2",
      name: "New global template",
      project_id: null,
      project_name: null,
      category: "feature",
      urgency_reporter: "normal",
      title_template: "Global feature title",
      description_template: "Global feature description with enough detail.",
      checklist_items: ["Describe expected outcome", "Attach mockup"],
      is_active: true
    });
  });

  it("renders existing templates and creates a new one from modal", async () => {
    render(<AdminPage />);

    fireEvent.click(await screen.findByRole("button", { name: "admin.tabProjects" }));

    expect(await screen.findByText("Existing checkout template")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "admin.newTicketTemplate" }));

    fireEvent.change(screen.getByLabelText("admin.name"), {
      target: { value: "New global template" }
    });
    fireEvent.change(screen.getByLabelText("tickets.category"), {
      target: { value: "feature" }
    });
    fireEvent.change(screen.getByLabelText("tickets.urgency"), {
      target: { value: "normal" }
    });
    fireEvent.change(screen.getByLabelText("admin.templateTitle"), {
      target: { value: "Global feature title" }
    });
    fireEvent.change(screen.getByLabelText("admin.templateDescription"), {
      target: { value: "Global feature description with enough detail." }
    });
    fireEvent.change(screen.getByLabelText("admin.templateChecklist"), {
      target: { value: "Describe expected outcome\nAttach mockup" }
    });

    fireEvent.click(screen.getByRole("button", { name: "app.save" }));

    await waitFor(() => {
      expect(TicketTemplatesApi.createTicketTemplate).toHaveBeenCalledWith({
        name: "New global template",
        project_id: null,
        category: "feature",
        urgency_reporter: "normal",
        title_template: "Global feature title",
        description_template: "Global feature description with enough detail.",
        checklist_items: ["Describe expected outcome", "Attach mockup"],
        is_active: true
      });
    });
  });
});
