import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import LoginPage from "../Login";
import * as LanguageContext from "../../contexts/LanguageContext";

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: () => ({ requestOtp: vi.fn(), verifyOtp: vi.fn() })
}));
vi.mock("../../contexts/LanguageContext", () => ({ useLanguage: vi.fn() }));
vi.mock("../../api/settings", () => ({ getPublicSettings: () => Promise.resolve({}) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key) => key }) }));

describe("Login language switcher", () => {
  it("offers Italian alongside Polish and English", () => {
    const setLanguage = vi.fn();
    LanguageContext.useLanguage.mockReturnValue({ language: "pl", setLanguage });
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    const switcher = screen.getByRole("group", { name: "Language switch" });
    expect(switcher.querySelectorAll("button")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "PL" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "IT" }));
    expect(setLanguage).toHaveBeenCalledWith("it");
  });

  it("shows Italian as selected when it is the active language", () => {
    LanguageContext.useLanguage.mockReturnValue({ language: "it", setLanguage: vi.fn() });
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "IT" })).toHaveAttribute("aria-pressed", "true");
  });
});
