# Project category icons and language parity

## Boundary
- Core stores an optional short icon glyph on a project category and returns it with the category. Core does not know deployment-specific category keys.
- A deployment layer chooses the glyphs and localized labels for its own taxonomy. Existing categories without an icon retain the built-in icon or neutral fallback.
- Login and the authenticated shell expose the same supported languages. The selector is semantic, keyboard-accessible, and marks the selected language with `aria-pressed`.

## Implementation checklist
- Add a nullable `icon` column to `project_categories`, including migration for existing databases.
- Accept, validate, persist, and return `icon` through the category service and project API.
- Render the returned glyph as decorative (`aria-hidden`) beside the translated category name; never rely on the glyph alone.
- Let layered bootstrap update its declared icon on existing category rows without replacing ticket data.
- Test service round-trip, layered bootstrap update, language selector, and category rendering; verify the local three-layer browser flow.
