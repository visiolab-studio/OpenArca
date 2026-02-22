# TaskFlow — Specyfikacja UI/UX dla Agenta
**Wersja:** 1.0  
**Dokument przeznaczony dla:** Agenta AI przepisującego warstwę wizualną aplikacji  
**Nie zmieniaj logiki biznesowej ani struktury API — tylko warstwę prezentacji.**

---

## 1. Design System — Fundamenty

### 1.1 Filozofia designu

Styl: **nowoczesny minimalizm** w duchu Notion. Dużo białej przestrzeni, czysta hierarchia, zero dekoracji dla samej dekoracji. Każdy element musi mieć powód, żeby istnieć. Interfejs ma być **narzędziem, nie pokazem** — użytkownik skupia się na treści, nie na UI.

Główne zasady:
- Przestrzeń jest ważniejsza niż gęstość — lepiej mniej na ekranie, ale czytelnie
- Ostre rogi wszędzie — zero zaokrągleń lub absolutne minimum (border-radius: 0–2px)
- Kontrast przez wagę typografii, nie przez kolory
- Kolor używany oszczędnie — głównie do sygnalizacji statusu i akcentów interaktywnych

---

### 1.2 Tokeny kolorów (CSS Variables)

Zaimplementuj pełny system tokenów. Aplikacja obsługuje **light mode i dark mode** z przełącznikiem. Tokeny muszą być zdefiniowane dla obu trybów przez `[data-theme="light"]` i `[data-theme="dark"]` na elemencie `<html>`.

```css
/* ===== LIGHT MODE ===== */
[data-theme="light"] {
  /* Tła */
  --bg-primary:    #FFFFFF;
  --bg-secondary:  #F7F7F5;   /* jak Notion — bardzo lekka szarość */
  --bg-tertiary:   #EFEDE9;   /* hover, subtelne oddzielenie */
  --bg-overlay:    rgba(0, 0, 0, 0.04);

  /* Sidebar */
  --sidebar-bg:    #F7F7F5;
  --sidebar-hover: #EFEDE9;
  --sidebar-active:#E8E5DF;   /* podświetlenie aktywnego elementu */

  /* Tekst */
  --text-primary:  #1A1A1A;
  --text-secondary:#6B6B6B;
  --text-tertiary: #999999;
  --text-disabled: #C4C4C4;

  /* Obramowania */
  --border-default:#E5E5E2;
  --border-strong: #D4D4D0;
  --border-subtle: #F0F0EE;

  /* Akcent główny — fiolet/indygo */
  --accent:        #5B50D6;
  --accent-hover:  #4A40C5;
  --accent-subtle: #EEF0FF;
  --accent-text:   #FFFFFF;

  /* Akcent pomocniczy — żółty */
  --yellow:        #F6DA3F;
  --yellow-hover:  #E8CB2A;
  --yellow-subtle: #FEFAEC;
  --yellow-text:   #1A1A1A;

  /* Statusy — tła i teksty dla solid pill badge */
  --status-submitted-bg:    #F0F0F0;
  --status-submitted-text:  #555555;
  --status-verified-bg:     #E8F0FF;
  --status-verified-text:   #2D5BE3;
  --status-in_progress-bg:  #E6FAF0;
  --status-in_progress-text:#1A8A4A;
  --status-waiting-bg:      #FFF8E6;
  --status-waiting-text:    #A05E00;
  --status-blocked-bg:      #FFECEC;
  --status-blocked-text:    #C52B2B;
  --status-closed-bg:       #F0F0F0;
  --status-closed-text:     #888888;

  /* Priorytety — kolor lewego bordera kart Kanban */
  --priority-critical: #E53E3E;
  --priority-high:     #ED8936;
  --priority-normal:   #5B50D6;
  --priority-low:      #A0AEC0;

  /* Inne */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
  --radius:    2px;   /* globalny border-radius — ostre rogi */
}

/* ===== DARK MODE ===== */
[data-theme="dark"] {
  /* Tła */
  --bg-primary:    #191919;   /* Notion dark */
  --bg-secondary:  #202020;
  --bg-tertiary:   #2A2A2A;
  --bg-overlay:    rgba(255, 255, 255, 0.04);

  /* Sidebar */
  --sidebar-bg:    #202020;
  --sidebar-hover: #2A2A2A;
  --sidebar-active:#303030;

  /* Tekst */
  --text-primary:  #EBEBEA;
  --text-secondary:#9B9A97;
  --text-tertiary: #64635F;
  --text-disabled: #3D3D3A;

  /* Obramowania */
  --border-default:#2F2F2F;
  --border-strong: #3D3D3A;
  --border-subtle: #252525;

  /* Akcent główny */
  --accent:        #7B72E9;
  --accent-hover:  #8E86F0;
  --accent-subtle: #1E1C3A;
  --accent-text:   #FFFFFF;

  /* Akcent pomocniczy — żółty */
  --yellow:        #F6DA3F;
  --yellow-hover:  #FFE666;
  --yellow-subtle: #2A2510;
  --yellow-text:   #1A1A1A;

  /* Statusy dark */
  --status-submitted-bg:    #2A2A2A;
  --status-submitted-text:  #9B9A97;
  --status-verified-bg:     #1A1E35;
  --status-verified-text:   #7B9EFF;
  --status-in_progress-bg:  #0F2A1E;
  --status-in_progress-text:#4CAF82;
  --status-waiting-bg:      #2A2010;
  --status-waiting-text:    #E6A020;
  --status-blocked-bg:      #2A1010;
  --status-blocked-text:    #FF6B6B;
  --status-closed-bg:       #252525;
  --status-closed-text:     #64635F;

  /* Priorytety */
  --priority-critical: #E53E3E;
  --priority-high:     #ED8936;
  --priority-normal:   #7B72E9;
  --priority-low:      #4A4A4A;

  --shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
  --radius:    2px;
}
```

---

### 1.3 Typografia

**Font:** `DM Sans` (Google Fonts) — załaduj przez `<link>` lub `@import`.

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');

:root {
  --font-sans: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'DM Mono', 'Courier New', monospace;
}

body {
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
  background: var(--bg-primary);
  -webkit-font-smoothing: antialiased;
}
```

**Skala typograficzna:**

```css
/* Nagłówki */
.text-xs    { font-size: 11px; line-height: 1.4; }
.text-sm    { font-size: 12px; line-height: 1.5; }
.text-base  { font-size: 14px; line-height: 1.6; }
.text-md    { font-size: 15px; line-height: 1.5; }
.text-lg    { font-size: 18px; line-height: 1.4; font-weight: 600; }
.text-xl    { font-size: 22px; line-height: 1.3; font-weight: 700; }
.text-2xl   { font-size: 28px; line-height: 1.2; font-weight: 700; }

/* Numery ticketów — monospace */
.ticket-number {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
  letter-spacing: 0.02em;
}
```

---

### 1.4 Spacing

System 4px:
```
4px  — odstępy wewnętrzne, gap między ikonami
8px  — padding małych elementów, gap w listach
12px — padding przycisków, odstępy między sekcjami
16px — standardowy padding kart, sekcji
20px — padding sidebaru, większych kontenerów
24px — padding głównej treści
32px — sekcje na dashboardzie
48px — duże odstępy między sekcjami strony
```

---

## 2. Layout — Struktura Strony

### 2.1 Główny layout aplikacji

```
┌─────────────────────────────────────────────────┐
│  SIDEBAR (240px stały)  │  MAIN CONTENT          │
│                         │  (flex: 1, scroll)     │
│  Logo + nazwa           │                        │
│  ─────────────────      │  [topbar z breadcrumb] │
│  Nawigacja (ikona+tekst)│                        │
│                         │  [treść widoku]        │
│  ─────────────────      │                        │
│  User info + theme      │                        │
│  toggle na dole         │                        │
└─────────────────────────────────────────────────┘
```

**CSS:**
```css
.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--bg-primary);
}

.sidebar {
  width: 240px;
  flex-shrink: 0;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border-default);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.page-content {
  padding: 32px 40px;
  max-width: 1200px;   /* dla widoków z treścią */
  width: 100%;
}

/* Kanban i inne pełnoekranowe widoki — bez max-width */
.page-content--full {
  padding: 24px 32px;
  max-width: none;
}
```

---

### 2.2 Sidebar

```css
/* Logo / nazwa aplikacji */
.sidebar-header {
  padding: 16px 16px 8px;
  border-bottom: 1px solid var(--border-subtle);
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  text-decoration: none;
}

.sidebar-logo-icon {
  width: 28px;
  height: 28px;
  background: var(--accent);
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px;
  font-weight: 700;
}

/* Sekcje nawigacyjne */
.sidebar-section {
  padding: 8px 8px;
}

.sidebar-section-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding: 4px 8px 4px;
  margin-bottom: 2px;
}

/* Elementy nawigacyjne */
.sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: var(--radius);
  font-size: 14px;
  font-weight: 400;
  color: var(--text-secondary);
  text-decoration: none;
  transition: background 0.1s, color 0.1s;
  cursor: pointer;
  user-select: none;
}

.sidebar-item:hover {
  background: var(--sidebar-hover);
  color: var(--text-primary);
}

/* AKTYWNY ELEMENT — Notion-style: pełna szerokość z tłem */
.sidebar-item.active {
  background: var(--sidebar-active);
  color: var(--text-primary);
  font-weight: 500;
}

.sidebar-item-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: inherit;
  opacity: 0.7;
}

.sidebar-item.active .sidebar-item-icon {
  opacity: 1;
  color: var(--accent);
}

/* Badge z licznikiem (np. liczba otwartych ticketów) */
.sidebar-badge {
  margin-left: auto;
  font-size: 11px;
  font-weight: 600;
  background: var(--bg-tertiary);
  color: var(--text-tertiary);
  padding: 1px 6px;
  border-radius: 20px;
  min-width: 18px;
  text-align: center;
}

/* Dół sidebaru — user + theme toggle */
.sidebar-footer {
  margin-top: auto;
  border-top: 1px solid var(--border-subtle);
  padding: 12px 8px;
}

.sidebar-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius);
  cursor: pointer;
}

.sidebar-user:hover {
  background: var(--sidebar-hover);
}

.sidebar-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--accent-subtle);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

/* Przełącznik light/dark */
.theme-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: var(--radius);
  cursor: pointer;
  font-size: 13px;
  color: var(--text-tertiary);
}

.theme-toggle:hover {
  background: var(--sidebar-hover);
  color: var(--text-primary);
}
```

---

### 2.3 Topbar (nagłówek treści)

```css
.page-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 40px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-primary);
  position: sticky;
  top: 0;
  z-index: 10;
}

.page-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.page-breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-tertiary);
}
```

---

## 3. Komponenty Bazowe

### 3.1 Przyciski

```css
/* Bazowy styl */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 14px;
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 500;
  border: none;
  border-radius: var(--radius);
  cursor: pointer;
  transition: background 0.1s, opacity 0.1s;
  white-space: nowrap;
  text-decoration: none;
}

/* Primary — akcent fioletowy */
.btn-primary {
  background: var(--accent);
  color: var(--accent-text);
}
.btn-primary:hover { background: var(--accent-hover); }

/* Yellow — akcent żółty (CTA wyróżniony, np. "Nowe zgłoszenie") */
.btn-yellow {
  background: var(--yellow);
  color: var(--yellow-text);
  font-weight: 600;
}
.btn-yellow:hover { background: var(--yellow-hover); }

/* Secondary — subtelny */
.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}
.btn-secondary:hover { background: var(--bg-overlay); }

/* Ghost — transparentny */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
}
.btn-ghost:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

/* Danger */
.btn-danger {
  background: #FEE2E2;
  color: #991B1B;
}
.btn-danger:hover { background: #FECACA; }

/* Rozmiary */
.btn-sm { padding: 4px 10px; font-size: 12px; }
.btn-lg { padding: 10px 20px; font-size: 15px; }

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-icon {
  padding: 7px;
  aspect-ratio: 1;
}
```

### 3.2 Inputy i formularze

```css
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 20px;
}

.form-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.form-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.5;
}

.form-input,
.form-textarea,
.form-select {
  width: 100%;
  padding: 9px 12px;
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--text-primary);
  background: var(--bg-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius);
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.form-input:hover,
.form-textarea:hover {
  border-color: var(--border-strong);
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-subtle);
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
  line-height: 1.6;
}

/* Błąd walidacji */
.form-input.error,
.form-textarea.error {
  border-color: var(--priority-critical);
  box-shadow: 0 0 0 3px #FFECEC;
}

.form-error-msg {
  font-size: 12px;
  color: var(--priority-critical);
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Licznik znaków */
.form-char-count {
  font-size: 11px;
  color: var(--text-tertiary);
  text-align: right;
  margin-top: 2px;
}
.form-char-count.warning { color: var(--status-waiting-text); }
.form-char-count.error   { color: var(--priority-critical); }

/* Instrukcja w formularzu — wyróżniony box */
.form-instruction {
  background: var(--yellow-subtle);
  border-left: 3px solid var(--yellow);
  padding: 10px 14px;
  border-radius: 0 var(--radius) var(--radius) 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 8px;
}
```

### 3.3 Status Badge — solid pill

```css
/* Bazowy badge */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 20px;     /* pill — wyjątek od sharp corners, bo badge to etykieta */
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

/* Statusy */
.badge-submitted   { background: var(--status-submitted-bg);  color: var(--status-submitted-text); }
.badge-verified    { background: var(--status-verified-bg);   color: var(--status-verified-text); }
.badge-in_progress { background: var(--status-in_progress-bg);color: var(--status-in_progress-text); }
.badge-waiting     { background: var(--status-waiting-bg);    color: var(--status-waiting-text); }
.badge-blocked     { background: var(--status-blocked-bg);    color: var(--status-blocked-text); }
.badge-closed      { background: var(--status-closed-bg);     color: var(--status-closed-text); }

/* Priorytety */
.badge-critical { background: #FFECEC; color: var(--priority-critical); }
.badge-high     { background: #FFF3E6; color: var(--priority-high); }
.badge-normal   { background: var(--accent-subtle); color: var(--accent); }
.badge-low      { background: var(--bg-tertiary); color: var(--text-tertiary); }

/* Kropka przed tekstem (opcjonalnie dla niektórych badge) */
.badge::before {
  content: '';
  display: block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.7;
}

/* Badge bez kropki — użyj klasy .badge-no-dot */
.badge-no-dot::before { display: none; }
```

### 3.4 Karty (ogólne)

```css
.card {
  background: var(--bg-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius);
  padding: 20px;
}

.card-hover {
  transition: border-color 0.15s, box-shadow 0.15s;
  cursor: pointer;
}

.card-hover:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-sm);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
```

### 3.5 Divider i sekcje

```css
.divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 20px 0;
}

.section-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 12px;
}
```

---

## 4. Widok: Kanban Board

### 4.1 Layout boardu

```css
.kanban-board {
  display: flex;
  gap: 16px;
  padding: 24px 32px;
  overflow-x: auto;
  align-items: flex-start;
  height: calc(100vh - 60px);  /* pełna wysokość minus topbar */
}

/* Kolumna */
.kanban-column {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  max-height: 100%;
}

.kanban-column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 4px 10px;
  margin-bottom: 4px;
}

.kanban-column-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Kolorowy indicator kolumny */
.kanban-column-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.col-submitted   .kanban-column-indicator { background: #999; }
.col-verified    .kanban-column-indicator { background: var(--accent); }
.col-in_progress .kanban-column-indicator { background: #1A8A4A; }
.col-waiting     .kanban-column-indicator { background: #E6A020; }
.col-blocked     .kanban-column-indicator { background: #E53E3E; }
.col-closed      .kanban-column-indicator { background: #555; }

.kanban-column-count {
  font-size: 11px;
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
  padding: 1px 7px;
  border-radius: 10px;
}

/* Obszar kart (scrollowalny) */
.kanban-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  padding: 2px;   /* żeby nie ucinać box-shadow */
}
```

### 4.2 Karta ticketu na Kanbanie

Karta zawiera: tytuł, priorytet (lewy border + badge), planowaną datę.

```css
.kanban-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius);
  border-left-width: 3px;  /* kolorowy pasek priorytetu */
  padding: 12px 14px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
  user-select: none;
}

/* Kolory lewego bordera wg priorytetu */
.kanban-card[data-priority="critical"] { border-left-color: var(--priority-critical); }
.kanban-card[data-priority="high"]     { border-left-color: var(--priority-high); }
.kanban-card[data-priority="normal"]   { border-left-color: var(--priority-normal); }
.kanban-card[data-priority="low"]      { border-left-color: var(--priority-low); }

.kanban-card:hover {
  border-color: var(--border-strong);
  border-left-color: inherit;  /* zachowaj kolor priorytetu */
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

/* Drag aktywny */
.kanban-card.dragging {
  opacity: 0.7;
  box-shadow: var(--shadow-md);
  transform: rotate(1deg) scale(1.02);
}

/* Numer ticketu */
.kanban-card-number {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-tertiary);
  margin-bottom: 6px;
}

/* Tytuł */
.kanban-card-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.4;
  margin-bottom: 10px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Stopka karty — priorytet + data */
.kanban-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.kanban-card-date {
  font-size: 11px;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Data przeterminowana */
.kanban-card-date.overdue {
  color: var(--priority-critical);
  font-weight: 500;
}

/* Drag-over placeholder */
.kanban-drop-zone {
  border: 2px dashed var(--accent);
  background: var(--accent-subtle);
  border-radius: var(--radius);
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--accent);
  opacity: 0;
  transition: opacity 0.15s;
}
.kanban-drop-zone.active { opacity: 1; }
```

---

## 5. Widok: Formularz Nowego Zgłoszenia

### 5.1 Layout formularza

```css
/* Formularz w kontenerze z max-width */
.new-ticket-page {
  padding: 40px;
  max-width: 760px;
}

.new-ticket-header {
  margin-bottom: 32px;
}

.new-ticket-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.new-ticket-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
}
```

### 5.2 Progress bar formularza

```css
.form-progress {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 32px;
  position: relative;
}

.form-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  position: relative;
}

/* Linia łącząca kroki */
.form-step::before {
  content: '';
  position: absolute;
  top: 14px;
  left: -50%;
  width: 100%;
  height: 1px;
  background: var(--border-default);
  z-index: 0;
}
.form-step:first-child::before { display: none; }

.form-step-circle {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--border-default);
  background: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  position: relative;
  z-index: 1;
  transition: all 0.2s;
}

.form-step.active .form-step-circle {
  border-color: var(--accent);
  background: var(--accent);
  color: white;
}

.form-step.done .form-step-circle {
  border-color: var(--status-in_progress-text);
  background: var(--status-in_progress-text);
  color: white;
}

.form-step-label {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 6px;
  text-align: center;
  font-weight: 500;
}
.form-step.active .form-step-label { color: var(--accent); }
```

### 5.3 Sekcja instrukcji w formularzu

Każda sekcja formularza, gdzie wymagamy szczegółów, musi mieć wyróżnioną instrukcję.

```css
/* Box z instrukcją — żółty lewy border */
.form-instruction-box {
  background: var(--yellow-subtle);
  border: 1px solid rgba(246, 218, 63, 0.3);
  border-left: 3px solid var(--yellow);
  padding: 12px 16px;
  margin-bottom: 16px;
  border-radius: 0 var(--radius) var(--radius) 0;
}

.form-instruction-box-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.form-instruction-box-title::before {
  content: '💡';
  font-size: 13px;
}

.form-instruction-box p {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
}

.form-instruction-box ul {
  margin: 6px 0 0;
  padding-left: 16px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.7;
}
```

### 5.4 Pole "Zły przykład vs Dobry przykład"

Dla tytułu i opisu — pokaż użytkownikowi jak powinno wyglądać zgłoszenie:

```css
.form-examples {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}

.form-example {
  padding: 8px 12px;
  border-radius: var(--radius);
  font-size: 12px;
  line-height: 1.5;
}

.form-example-bad {
  background: #FFF5F5;
  border: 1px solid #FED7D7;
  color: #C53030;
}

.form-example-good {
  background: #F0FFF4;
  border: 1px solid #C6F6D5;
  color: #276749;
}

.form-example-label {
  font-weight: 700;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 3px;
  opacity: 0.7;
}
```

### 5.5 Wybór kategorii — duże przyciski

```css
.category-selector {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
  margin-bottom: 24px;
}

.category-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  border: 1.5px solid var(--border-default);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
}

.category-option:hover {
  border-color: var(--accent);
  background: var(--accent-subtle);
}

.category-option.selected {
  border-color: var(--accent);
  background: var(--accent-subtle);
  box-shadow: 0 0 0 3px var(--accent-subtle);
}

.category-option-icon {
  font-size: 22px;
}

.category-option-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
}

.category-option-desc {
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.4;
}
```

---

## 6. Widok: Lista TODO Developera

### 6.1 Layout

```css
.todo-page {
  padding: 32px 40px;
  max-width: 900px;
}

/* Podsumowanie na górze */
.todo-summary {
  display: flex;
  gap: 24px;
  margin-bottom: 28px;
  padding: 16px 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius);
}

.todo-summary-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.todo-summary-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
}

.todo-summary-label {
  font-size: 11px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
}

/* Pasek akcji nad listą */
.todo-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;
}

.todo-toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
```

### 6.2 Wiersz zadania

```css
.todo-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.todo-item {
  display: grid;
  grid-template-columns: 32px 16px 1fr auto auto auto auto;
  /* drag | priorytet-dot | tytuł | ticket | czas | data | akcje */
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: var(--radius);
  transition: background 0.1s, border-color 0.1s;
  cursor: default;
}

.todo-item:hover {
  background: var(--bg-secondary);
  border-color: var(--border-default);
}

/* In progress — lekkie podświetlenie */
.todo-item.in_progress {
  background: var(--accent-subtle);
  border-color: rgba(91, 80, 214, 0.15);
}

/* Drag handle */
.todo-drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  cursor: grab;
  opacity: 0;
  transition: opacity 0.15s;
}
.todo-item:hover .todo-drag-handle { opacity: 1; }

/* Priorytet dot */
.todo-priority-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.todo-priority-dot[data-priority="critical"] { background: var(--priority-critical); }
.todo-priority-dot[data-priority="high"]     { background: var(--priority-high); }
.todo-priority-dot[data-priority="normal"]   { background: var(--priority-normal); }
.todo-priority-dot[data-priority="low"]      { background: var(--priority-low); }

/* Tytuł */
.todo-item-title {
  font-size: 14px;
  font-weight: 400;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Powiązany ticket */
.todo-ticket-link {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
  text-decoration: none;
  padding: 2px 6px;
  background: var(--bg-tertiary);
  border-radius: var(--radius);
  white-space: nowrap;
}
.todo-ticket-link:hover { color: var(--accent); }

/* Szacowany czas */
.todo-time {
  font-size: 12px;
  color: var(--text-tertiary);
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Planowana data */
.todo-date {
  font-size: 12px;
  color: var(--text-tertiary);
  white-space: nowrap;
}
.todo-date.overdue { color: var(--priority-critical); font-weight: 500; }
.todo-date.soon    { color: var(--status-waiting-text); }

/* Akcje — widoczne na hover */
.todo-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.1s;
}
.todo-item:hover .todo-actions { opacity: 1; }

/* Przycisk "Zacznij" / "Ukończ" */
.todo-status-btn {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: var(--radius);
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-secondary);
  transition: all 0.1s;
  white-space: nowrap;
}
.todo-status-btn:hover {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}
.todo-item.in_progress .todo-status-btn:hover {
  background: var(--status-in_progress-text);
  border-color: var(--status-in_progress-text);
}

/* Sekcja "Automatyczne sortowanie" */
.todo-auto-sort-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--yellow-subtle);
  border: 1px solid rgba(246, 218, 63, 0.4);
  border-radius: var(--radius);
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--text-secondary);
}
```

---

## 7. Widok: Dashboard

### 7.1 Kafelki statystyk (obłożenie)

```css
.dashboard-stats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 32px;
}

.stat-card {
  padding: 20px;
  background: var(--bg-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 0.15s;
}

.stat-card:hover { border-color: var(--border-strong); }

.stat-card-value {
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
  color: var(--text-primary);
}

.stat-card-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

/* Warianty kolorystyczne kafelków */
.stat-card-in_progress .stat-card-value { color: var(--status-in_progress-text); }
.stat-card-blocked .stat-card-value     { color: var(--priority-critical); }
.stat-card-waiting .stat-card-value     { color: var(--status-waiting-text); }
```

---

## 8. Widok: Szczegóły Ticketu

```css
.ticket-detail {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 32px;
  padding: 32px 40px;
  align-items: start;
}

/* Lewa kolumna — treść */
.ticket-main {}

/* Prawa kolumna — metadane */
.ticket-sidebar {
  position: sticky;
  top: 80px;
}

.ticket-meta-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius);
  padding: 16px;
}

.ticket-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 13px;
}
.ticket-meta-row:last-child { border-bottom: none; }

.ticket-meta-label {
  color: var(--text-tertiary);
  font-weight: 500;
}

/* Notatka wewnętrzna — żółte tło */
.internal-note {
  background: var(--yellow-subtle);
  border: 1px solid rgba(246, 218, 63, 0.4);
  border-left: 3px solid var(--yellow);
  padding: 12px 16px;
  border-radius: 0 var(--radius) var(--radius) 0;
  margin: 16px 0;
}

.internal-note-header {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Wątek komentarzy */
.comments-thread {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-top: 24px;
}

.comment {
  display: flex;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid var(--border-subtle);
}

.comment-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
}

/* Komentarz od deveiopera */
.comment.developer .comment-avatar {
  background: var(--accent-subtle);
  color: var(--accent);
}

/* Komentarz od użytkownika */
.comment.user .comment-avatar {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.comment-author {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.comment-developer-badge {
  font-size: 10px;
  padding: 1px 6px;
  background: var(--accent-subtle);
  color: var(--accent);
  border-radius: 10px;
  font-weight: 600;
  margin-left: 6px;
}

.comment-time {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-left: 8px;
}

.comment-content {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.6;
  margin-top: 4px;
}

/* Pytanie od dewelopera — wyróżnione */
.comment.question {
  background: var(--accent-subtle);
  margin: 4px 0;
  padding: 12px 16px;
  border-radius: var(--radius);
  border-left: 3px solid var(--accent);
}

/* Historia zmian */
.history-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 6px 0;
  font-size: 12px;
  color: var(--text-tertiary);
}

.history-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--border-strong);
  margin-top: 5px;
  flex-shrink: 0;
}
```

---

## 9. Strona logowania

```css
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
}

.login-card {
  width: 380px;
  background: var(--bg-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius);
  padding: 40px;
  box-shadow: var(--shadow-md);
}

.login-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 32px;
}

.login-logo-icon {
  width: 36px;
  height: 36px;
  background: var(--accent);
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
  font-weight: 700;
}

.login-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.login-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 28px;
}

/* Inputy kodu OTP — 8 cyfr */
.otp-inputs {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin: 24px 0;
}

.otp-input {
  width: 40px;
  height: 48px;
  text-align: center;
  font-size: 20px;
  font-weight: 700;
  font-family: var(--font-mono);
  border: 1.5px solid var(--border-default);
  border-radius: var(--radius);
  background: var(--bg-primary);
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.15s;
}

.otp-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-subtle);
}

.otp-input.filled {
  border-color: var(--accent);
  background: var(--accent-subtle);
}

/* Separator między grupą 4 cyfr */
.otp-separator {
  display: flex;
  align-items: center;
  color: var(--text-tertiary);
  font-size: 20px;
}

/* Timer ważności kodu */
.otp-timer {
  text-align: center;
  font-size: 13px;
  color: var(--text-tertiary);
  margin-top: 8px;
}

.otp-timer.expiring { color: var(--priority-critical); }
```

---

## 10. Animacje i interakcje

```css
/* Globalne przejścia */
* {
  transition-property: background-color, border-color, color, opacity;
  transition-duration: 0.1s;
  transition-timing-function: ease;
}

/* Skeleton loader — dla stanów ładowania */
.skeleton {
  background: linear-gradient(
    90deg,
    var(--bg-tertiary) 25%,
    var(--bg-secondary) 50%,
    var(--bg-tertiary) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: var(--radius);
}

@keyframes skeleton-loading {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Toast powiadomień */
.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  padding: 12px 16px;
  background: var(--text-primary);
  color: var(--bg-primary);
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 500;
  box-shadow: var(--shadow-md);
  z-index: 1000;
  animation: toast-in 0.2s ease;
}

@keyframes toast-in {
  from { transform: translateY(10px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}

/* Fade in dla kart */
@keyframes fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.animate-fade-up {
  animation: fade-up 0.2s ease forwards;
}

/* Dla list — kolejne elementy z opóźnieniem */
.animate-fade-up:nth-child(1) { animation-delay: 0ms; }
.animate-fade-up:nth-child(2) { animation-delay: 30ms; }
.animate-fade-up:nth-child(3) { animation-delay: 60ms; }
.animate-fade-up:nth-child(4) { animation-delay: 90ms; }
.animate-fade-up:nth-child(5) { animation-delay: 120ms; }

/* Focus visible — dostępność */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

---

## 11. Ikony

Używaj biblioteki **Lucide React** (`lucide-react`) — lekka, spójna ikona-set. Rozmiar ikon w nawigacji: 16px. W treści: 14px. Akcje: 14–16px.

```jsx
// Przykład użycia ikon nawigacyjnych:
import { LayoutDashboard, Ticket, ListTodo, Kanban, Settings, BarChart2 } from 'lucide-react';

// Sidebar mapping:
const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard',        path: '/',            roles: ['user', 'developer'] },
  { icon: PlusCircle,      label: 'Nowe zgłoszenie',  path: '/new-ticket',  roles: ['user', 'developer'] },
  { icon: Ticket,          label: 'Moje zgłoszenia',  path: '/my-tickets',  roles: ['user', 'developer'] },
  { icon: BarChart2,       label: 'Obłożenie',        path: '/overview',    roles: ['user', 'developer'] },
  { icon: Kanban,          label: 'Kanban',            path: '/board',       roles: ['developer'] },
  { icon: ListTodo,        label: 'Lista TODO',        path: '/dev-todo',    roles: ['developer'] },
  { icon: Settings,        label: 'Ustawienia',        path: '/admin',       roles: ['developer'] },
];
```

---

## 12. Responsywność

Aplikacja docelowa: **desktop + tablet** (min. 768px).

```css
/* Tablet */
@media (max-width: 1024px) {
  .sidebar { width: 200px; }
  .ticket-detail { grid-template-columns: 1fr; }
  .kanban-column { width: 240px; }
}

/* Mobile — tylko widoki user-facing */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: -240px;
    z-index: 100;
    transition: left 0.2s;
    width: 240px;
  }
  .sidebar.open { left: 0; }
  
  .app-layout { flex-direction: column; }
  .page-content { padding: 20px 16px; }
  
  /* Kanban nie jest dostępny na mobile */
  .kanban-board { display: none; }

  .dashboard-stats { grid-template-columns: repeat(2, 1fr); }
  .form-examples   { grid-template-columns: 1fr; }
}
```

---

## 13. Przełącznik motywu (dark/light)

Zaimplementuj przełącznik jako toggle w stopce sidebaru. Zapis preferencji w `localStorage` pod kluczem `taskflow-theme`. Przy załadowaniu strony — zastosuj zapisany motyw przed renderowaniem (w `<head>` jako inline script, żeby uniknąć mignięcia).

```html
<!-- W <head> — zapobiega FOUC (Flash Of Unstyled Content) -->
<script>
  const theme = localStorage.getItem('taskflow-theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
</script>
```

```jsx
// Hook
function useTheme() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem('taskflow-theme') || 'light'
  );
  
  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('taskflow-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };
  
  return { theme, toggle };
}
```

---

## 14. Checklist dla Agenta

Przed zakończeniem implementacji sprawdź każdy punkt:

**Globalne:**
- [ ] CSS variables (`--bg-primary`, `--accent` itd.) zdefiniowane dla obu trybów
- [ ] DM Sans załadowany z Google Fonts
- [ ] `border-radius: var(--radius)` (2px) stosowany wszędzie oprócz badge (pill) i avatarów (50%)
- [ ] Przełącznik dark/light działa i zapisuje preferencję
- [ ] FOUC zablokowany przez inline script w `<head>`
- [ ] Ikony Lucide React zainstalowane i używane spójnie

**Sidebar:**
- [ ] Szerokość 240px, stały
- [ ] Aktywny element: pełne tło `var(--sidebar-active)` na całej szerokości
- [ ] Ikona aktywnego elementu w kolorze `var(--accent)`
- [ ] User info i theme toggle na dole sidebaru

**Kanban:**
- [ ] Lewy border 3px w kolorze priorytetu
- [ ] Karty zawierają: #numer (mono), tytuł (2 linie max), badge priorytetu, datę
- [ ] Data przeterminowana wyświetlana w kolorze `var(--priority-critical)`
- [ ] Hover: `translateY(-1px)` + shadow

**Formularz zgłoszenia:**
- [ ] Progress bar z 4 krokami
- [ ] `form-instruction-box` (żółty lewy border) przy każdym ważnym polu
- [ ] Przykłady złe/dobre dla tytułu
- [ ] Licznik znaków na wszystkich polach z limitem
- [ ] Walidacja blokuje submit i pokazuje konkretne komunikaty
- [ ] Wybór kategorii jako duże kafelki, nie dropdown

**TODO Developera:**
- [ ] Drag handle widoczny tylko na hover
- [ ] `in_progress` zadania z subtlenym akcentem tłem
- [ ] Bar z "Zastosuj automatyczne sortowanie"
- [ ] Podsumowanie (łączny czas, liczba per priorytet) na górze
- [ ] Akcje (Zacznij/Ukończ, edytuj, usuń) widoczne tylko na hover

**Badge:**
- [ ] Solid pill (border-radius: 20px) z kolorowym tłem
- [ ] Kropka (::before) jako indicator
- [ ] Uppercase + letter-spacing

**Ogólne:**
- [ ] `var(--shadow-sm)` na kartach zamiast twardych wartości
- [ ] Skeleton loadery dla wszystkich list i kart
- [ ] Toast po każdej akcji (zapisano, zmieniono status, błąd)
- [ ] Focus-visible dla klawiatury (outline: 2px solid var(--accent))
