import { describe, it, expect } from "vitest";
import { resolveCategoryText } from "../categoryLabel";

const entry = {
  key: "data_check",
  label: "Verifica dei dati",
  description: "Serve un'informazione dal sistema.",
  translations: {
    pl: { label: "Sprawdzenie danych", description: "Potrzebujesz informacji z systemu." },
    it: { label: "Verifica dei dati" }
  }
};

describe("resolveCategoryText", () => {
  it("wybiera tlumaczenie dla jezyka interfejsu, nie dla projektu", () => {
    expect(resolveCategoryText(entry, "pl").label).toBe("Sprawdzenie danych");
    expect(resolveCategoryText(entry, "it").label).toBe("Verifica dei dati");
  });

  it("uzupelnia brakujace pole z jezyka zapasowego lub konfiguracji", () => {
    // wloski ma nazwe, ale nie ma opisu — opis spada do konfiguracji
    expect(resolveCategoryText(entry, "it").description).toBe("Serve un'informazione dal sistema.");
  });

  it("dla nieznanego jezyka schodzi do etykiety domyslnej", () => {
    expect(resolveCategoryText(entry, "de").label).toBe("Verifica dei dati");
  });

  it("znosi brak tlumaczen i pusty wpis", () => {
    expect(resolveCategoryText({ label: "X" }, "pl")).toEqual({ label: "X", description: null });
    expect(resolveCategoryText(null, "pl")).toEqual({ label: null, description: null });
  });

  it("ignoruje tlumaczenie puste lub zlego typu", () => {
    const broken = { label: "X", translations: { pl: { label: "   " }, it: "nie-obiekt" } };
    expect(resolveCategoryText(broken, "pl").label).toBe("X");
    expect(resolveCategoryText(broken, "it").label).toBe("X");
  });
});
