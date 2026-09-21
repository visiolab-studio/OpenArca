import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminPage from "../Admin";
import * as ProjectsApi from "../../api/projects";
import * as ServiceAccountsApi from "../../api/serviceAccounts";
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
  getReadiness: vi.fn(),
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

vi.mock("../../api/serviceAccounts", () => ({
  createServiceAccount: vi.fn(),
  disableServiceAccount: vi.fn(),
  getServiceAccounts: vi.fn(),
  revokeServiceAccount: vi.fn()
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    // Interpolation is exercised by one string (serviceAccountTokenIntro);
    // this fake translator appends the option so the substituted value is
    // still observable, instead of collapsing every key to itself.
    t: (key, options) => {
      if (options && typeof options.name === "string") {
        return `${key}:${options.name}`;
      }
      return key;
    }
  }),
  initReactI18next: { type: "3rdParty", init: () => {} }
}));

describe("Admin service accounts", () => {
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
    SettingsApi.getReadiness.mockResolvedValue({
      version: "0.2.6-rc2",
      edition: "open_core",
      data: { data_dir: "/data", sqlite_path: "/data/data.sqlite", backup_restore_docs: "docs" },
      checks: []
    });

    ProjectsApi.getProjects.mockResolvedValue([]);
    TicketTemplatesApi.getTicketTemplates.mockResolvedValue([]);
    UsersApi.getUsers.mockResolvedValue([]);

    ServiceAccountsApi.getServiceAccounts.mockResolvedValue([
      {
        id: "account-1",
        name: "claude-code on Piotr's laptop",
        description: "local coding agent",
        created_at: "2026-09-01 10:00:00",
        disabled_at: null,
        scopes: ["tickets:read"],
        last_used_at: null,
        revoked_at: null
      }
    ]);
  });

  it("reveals the clear token exactly once when a machine account is created", async () => {
    ServiceAccountsApi.createServiceAccount.mockResolvedValue({
      id: "account-2",
      name: "codex on Piotr's laptop",
      description: null,
      created_at: "2026-09-21 10:00:00",
      disabled_at: null,
      scopes: ["tickets:read", "projects:read"],
      last_used_at: null,
      revoked_at: null,
      token: "oa_secret-clear-token-value"
    });

    render(<AdminPage />);

    fireEvent.click(await screen.findByRole("button", { name: "admin.tabAgents" }));
    expect(await screen.findByText("claude-code on Piotr's laptop")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("admin.name"), {
      target: { value: "codex on Piotr's laptop" }
    });
    fireEvent.click(screen.getByLabelText("admin.serviceAccountScope.tickets:read"));
    fireEvent.click(screen.getByLabelText("admin.serviceAccountScope.projects:read"));
    fireEvent.click(screen.getByRole("button", { name: "admin.newServiceAccount" }));

    await waitFor(() => {
      expect(ServiceAccountsApi.createServiceAccount).toHaveBeenCalledWith({
        name: "codex on Piotr's laptop",
        description: undefined,
        scopes: ["tickets:read", "projects:read"]
      });
    });

    expect(await screen.findByText("admin.serviceAccountTokenWarning")).toBeInTheDocument();
    expect(screen.getByDisplayValue("oa_secret-clear-token-value")).toBeInTheDocument();
    expect(
      await screen.findByText("admin.serviceAccountTokenIntro:codex on Piotr's laptop")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "admin.serviceAccountTokenDismiss" }));
    expect(screen.queryByDisplayValue("oa_secret-clear-token-value")).not.toBeInTheDocument();
  });

  it("revokes a machine account's token", async () => {
    ServiceAccountsApi.revokeServiceAccount.mockResolvedValue({
      id: "account-1",
      name: "claude-code on Piotr's laptop",
      description: "local coding agent",
      created_at: "2026-09-01 10:00:00",
      disabled_at: null,
      scopes: ["tickets:read"],
      last_used_at: null,
      revoked_at: "2026-09-21 12:00:00"
    });

    render(<AdminPage />);

    fireEvent.click(await screen.findByRole("button", { name: "admin.tabAgents" }));
    fireEvent.click(await screen.findByRole("button", { name: "admin.serviceAccountRevoke" }));

    await waitFor(() => {
      expect(ServiceAccountsApi.revokeServiceAccount).toHaveBeenCalledWith("account-1");
    });
    expect(await screen.findByText("admin.serviceAccountRevoked")).toBeInTheDocument();
  });

  it("disables a machine account", async () => {
    ServiceAccountsApi.disableServiceAccount.mockResolvedValue({
      id: "account-1",
      name: "claude-code on Piotr's laptop",
      description: "local coding agent",
      created_at: "2026-09-01 10:00:00",
      disabled_at: "2026-09-21 12:00:00",
      scopes: ["tickets:read"],
      last_used_at: null,
      revoked_at: null
    });

    render(<AdminPage />);

    fireEvent.click(await screen.findByRole("button", { name: "admin.tabAgents" }));
    fireEvent.click(await screen.findByRole("button", { name: "admin.serviceAccountDisable" }));

    await waitFor(() => {
      expect(ServiceAccountsApi.disableServiceAccount).toHaveBeenCalledWith("account-1");
    });
    expect(await screen.findByText("admin.serviceAccountDisabled")).toBeInTheDocument();
  });
});
