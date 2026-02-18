import { describe, expect, it } from "vitest";
import { validateNewTicketForm } from "../NewTicket";

describe("validateNewTicketForm", () => {
  it("returns validation errors for incomplete bug report", () => {
    const errors = validateNewTicketForm({
      title: "Za krótki",
      description: "krótki",
      category: "bug",
      steps_to_reproduce: "",
      expected_result: "",
      actual_result: "",
      environment: ""
    });

    expect(errors.title).toBeTruthy();
    expect(errors.description).toBeTruthy();
    expect(errors.steps_to_reproduce).toBeTruthy();
    expect(errors.expected_result).toBeTruthy();
    expect(errors.actual_result).toBeTruthy();
    expect(errors.environment).toBeTruthy();
  });

  it("returns feature-specific errors when business goal is missing", () => {
    const errors = validateNewTicketForm({
      title: "Prośba o nową funkcję raportowania",
      description:
        "Chcemy mieć raport tygodniowy z podsumowaniem pracy zespołu i trendów wydajności dla każdego projektu, aby lepiej planować sprinty.",
      category: "feature",
      business_goal: ""
    });

    expect(errors.business_goal).toBeTruthy();
  });

  it("passes when bug payload is complete", () => {
    const errors = validateNewTicketForm({
      title: "Błąd walidacji formularza przy zapisie",
      description:
        "Po zapisaniu formularza system zwraca 500 i nie zapisuje rekordu. Dzieje się to stale dla użytkowników działu wsparcia i blokuje codzienną pracę.",
      category: "bug",
      steps_to_reproduce:
        "1. Otwórz formularz. 2. Uzupełnij pola. 3. Kliknij Zapisz. 4. Zobacz błąd po stronie serwera.",
      expected_result: "Formularz powinien zapisać rekord i pokazać potwierdzenie operacji.",
      actual_result: "Pojawia się błąd 500 i rekord nie jest tworzony.",
      environment: "Chrome 121, Windows 11, produkcja"
    });

    expect(Object.keys(errors)).toHaveLength(0);
  });
});
