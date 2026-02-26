import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProjectBadge from "../ProjectBadge";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => (key === "tickets.projectNone" ? "No project" : key)
  })
}));

describe("ProjectBadge", () => {
  it("renders project name and custom icon url", () => {
    const { container } = render(
      <ProjectBadge
        name="Marketplace Core"
        color="#12AA55"
        iconUrl="/api/projects/1/icon?v=1"
      />
    );

    expect(screen.getByText("Marketplace Core")).toBeInTheDocument();
    const icon = container.querySelector(".project-badge-icon");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("src", "/api/projects/1/icon?v=1");
  });

  it("renders empty badge when showEmpty is true", () => {
    render(<ProjectBadge name="" showEmpty />);
    expect(screen.getByText("No project")).toBeInTheDocument();
  });
});
