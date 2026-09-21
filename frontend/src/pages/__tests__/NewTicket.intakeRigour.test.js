import { describe, it, expect } from "vitest";
import { validateNewTicketForm } from "../NewTicket";

const bugReport = {
  title: "Klientka nie moze pobrac materialu",
  // Tak wyglada realne zgloszenie od obslugi: przepisana wiadomosc klienta,
  // bez krokow reprodukcji.
  description:
    "Klientka pisze, ze po zakupie przycisk pobierania zwraca blad i plik sie nie pobiera.",
  category: "bug",
  steps_to_reproduce: "",
  expected_result: "",
  actual_result: "",
  environment: ""
};

describe("validateNewTicketForm", () => {
  it("wymaga szczegolow bledu, gdy projekt ich wymaga", () => {
    const errors = validateNewTicketForm(bugReport, { requireBugDetails: true });
    expect(errors.steps_to_reproduce).toBeDefined();
    expect(errors.environment).toBeDefined();
  });

  it("nie wymaga ich, gdy projekt rygor wylaczyl", () => {
    const errors = validateNewTicketForm(bugReport, { requireBugDetails: false });
    expect(errors.steps_to_reproduce).toBeUndefined();
    expect(errors.environment).toBeUndefined();
    // Prog 100 znakow tez byl czescia rygoru, wiec schodzi do 50.
    expect(errors.description).toBeUndefined();
  });

  it("przepuszcza jednozdaniowe pytanie w kategorii lekkiej", () => {
    const errors = validateNewTicketForm(
      { title: "Tag w filtrze", description: "Czy mozemy dodac tag?", category: "quick_question" },
      { requireBugDetails: false, simpleIntake: true }
    );
    expect(errors).toEqual({});
  });

  it("nie przepuszcza tego samego pytania poza kategoria lekka", () => {
    const errors = validateNewTicketForm(
      { title: "Tag w filtrze", description: "Czy mozemy dodac tag?", category: "billing" },
      { requireBugDetails: false, simpleIntake: false }
    );
    expect(errors.description).toBeDefined();
  });

  it("bez opcji zachowuje sie jak dotad — rygorystycznie", () => {
    expect(validateNewTicketForm(bugReport).steps_to_reproduce).toBeDefined();
  });
});
