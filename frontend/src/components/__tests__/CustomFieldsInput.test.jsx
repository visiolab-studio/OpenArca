import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CustomFieldsInput from "../CustomFieldsInput";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key })
}));

const definitions = [
  { field_key: "channel", label: "Sklep", field_type: "select", options: ["pl", "it"], required: true },
  { field_key: "order_number", label: "Numer zamówienia", field_type: "text", required: false }
];

describe("CustomFieldsInput", () => {
  it("keeps required context visible and groups optional fields for short intake", () => {
    const { container } = render(
      <CustomFieldsInput
        definitions={definitions}
        values={{}}
        errors={{}}
        onChange={vi.fn()}
        compactOptional
      />
    );

    expect(screen.getByLabelText(/Sklep/)).toBeVisible();
    const details = container.querySelector(".custom-fields-optional");
    expect(details).not.toHaveAttribute("open");
    expect(screen.getByLabelText("Numer zamówienia")).not.toBeVisible();
    fireEvent.click(screen.getByText("tickets.optionalFields"));
    expect(details).toHaveAttribute("open");
    expect(screen.getByLabelText("Numer zamówienia")).toBeVisible();
  });

  it("opens optional context when it contains a validation error", () => {
    const { container } = render(
      <CustomFieldsInput
        definitions={definitions}
        values={{ order_number: "wrong" }}
        errors={{ order_number: "Nieprawidłowa wartość" }}
        onChange={vi.fn()}
        compactOptional
      />
    );
    expect(container.querySelector(".custom-fields-optional")).toHaveAttribute("open");
    expect(screen.getByText("Nieprawidłowa wartość")).toBeVisible();
  });
});
