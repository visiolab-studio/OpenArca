const fs = require("fs");
const { extensionLayers } = require("../config");

// Subject access export and erasure, across core and every loaded layer.
//
// The hard part is that personal data does not live in one place: a person may
// appear in core tickets, in a capability layer's own tables, and in a
// deployment layer's fields. Core cannot guess at a layer's schema, so a layer
// DECLARES its surface by exporting backend/extensions/personal-data.js with
// { export(context), erase(context) }. A layer that declares nothing is skipped.
//
// Erasure anonymises rather than deletes wherever the record has operational
// meaning: a ticket that vanishes takes its history with it, and the team still
// needs to know the work happened.

const ANONYMISED_NAME = "[usunięty użytkownik]";

function loadLayerHandlers(layers) {
  return layers
    .map((layer) => {
      const file = layer.root ? `${layer.root}/backend/extensions/personal-data.js` : null;
      if (!file || !fs.existsSync(file)) {
        return null;
      }

      const resolved = require.resolve(file);
      delete require.cache[resolved];
      const loaded = require(file);

      if (!loaded || (typeof loaded.export !== "function" && typeof loaded.erase !== "function")) {
        throw new Error(
          `Invalid personal-data module in layer "${layer.name}" (${file}): expected { export } and/or { erase }`
        );
      }

      return { name: layer.name, handlers: loaded };
    })
    .filter(Boolean);
}

function findSubject(db, email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return null;
  return db.prepare("SELECT * FROM users WHERE email = ?").get(normalized) || null;
}

function exportCoreData(db, subject) {
  const tickets = db
    .prepare(
      `SELECT id, number, title, description, status, category, created_at, updated_at
       FROM tickets WHERE reporter_id = ? ORDER BY created_at ASC`
    )
    .all(subject.id);

  const comments = db
    .prepare(
      `SELECT id, ticket_id, content, is_internal, created_at
       FROM comments WHERE user_id = ? ORDER BY created_at ASC`
    )
    .all(subject.id);

  return {
    user: {
      id: subject.id,
      email: subject.email,
      name: subject.name,
      role: subject.role,
      language: subject.language,
      created_at: subject.created_at,
      last_login: subject.last_login
    },
    tickets,
    comments
  };
}

function exportPersonalData({ db, email, layers = extensionLayers || [] }) {
  const subject = findSubject(db, email);
  if (!subject) {
    return null;
  }

  const layerData = {};
  for (const { name, handlers } of loadLayerHandlers(layers)) {
    if (typeof handlers.export !== "function") continue;
    layerData[name] = handlers.export({ db, subject, email: subject.email });
  }

  return {
    generated_at: new Date().toISOString(),
    subject_email: subject.email,
    core: exportCoreData(db, subject),
    layers: layerData
  };
}

function erasePersonalData({ db, email, layers = extensionLayers || [] }) {
  const subject = findSubject(db, email);
  if (!subject) {
    return null;
  }

  // Layers erase FIRST, while the core user row still exists: their tables
  // carry foreign keys into core, so removing the user first could break them
  // or silently cascade away rows the layer meant to anonymise itself.
  const layerResults = {};
  for (const { name, handlers } of loadLayerHandlers(layers)) {
    if (typeof handlers.erase !== "function") continue;
    layerResults[name] = handlers.erase({ db, subject, email: subject.email });
  }

  const erase = db.transaction(() => {
    // Tickets and comments survive, anonymised. The work happened; the team
    // still needs its history.
    const anonymisedEmail = `erased-${subject.id}@invalid`;

    db.prepare(
      `UPDATE users
       SET email = ?, name = ?, avatar_filename = NULL, avatar_updated_at = NULL
       WHERE id = ?`
    ).run(anonymisedEmail, ANONYMISED_NAME, subject.id);

    db.prepare("DELETE FROM otp_codes WHERE email = ?").run(subject.email);
  });

  erase();

  return {
    subject_id: subject.id,
    anonymised: true,
    layers: layerResults
  };
}

module.exports = {
  ANONYMISED_NAME,
  exportPersonalData,
  erasePersonalData,
  loadLayerHandlers
};
