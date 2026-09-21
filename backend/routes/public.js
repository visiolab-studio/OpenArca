const express = require("express");
const { z } = require("zod");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");
const { validate } = require("../middleware/validate");
const {
  publicIntakeIpLimiter,
  publicIntakeEmailLimiter
} = require("../middleware/rate-limiters");
const { ticketsService } = require("../services/tickets");
const { customFieldsService } = require("../services/custom-fields");
const { sendEmail } = require("../services/email");
const { normalizeLanguage, translate } = require("../core/languages");
const { CustomFieldError } = require("../core/custom-fields");

// The only unauthenticated write path in the product.
//
// Everything reaching this router is hostile until proven otherwise: there is no
// session, no role and no prior trust. Three consequences shape the code below.
//   - It is opt-in per project and off by default, so no existing deployment
//     gains anonymous writes by upgrading.
//   - Both rate limit axes are applied, not one.
//   - Nothing the submitter sends selects a status, priority, assignee or
//     project field beyond the project itself.

const router = express.Router();

const intakeSchema = z
  .object({
    project_id: z.string().uuid(),
    email: z.string().trim().email().max(320),
    name: z.string().trim().min(1).max(160).optional(),
    title: z.string().trim().min(10).max(300),
    description: z.string().trim().min(50).max(20000),
    lang: z.string().trim().max(10).optional(),
    custom_fields: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional()
  })
  .strict();

const projectParamsSchema = z.object({ id: z.string().uuid() });

function getPublicProject(projectId) {
  return db
    .prepare(
      "SELECT id, name, public_intake_enabled FROM projects WHERE id = ? AND public_intake_enabled = 1"
    )
    .get(projectId);
}

// The submitter becomes a real reporter so the ticket has an owner and they can
// see it if they ever sign in. Creating the record does NOT grant access:
// logging in still goes through OTP and the domain allowlist, unchanged.
function findOrCreateReporter({ email, name, language }) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);
  if (existing) {
    return existing.id;
  }

  const id = uuidv4();
  db.prepare(
    `INSERT INTO users (id, email, name, role, language, created_at)
     VALUES (?, ?, ?, 'user', ?, datetime('now'))`
  ).run(id, normalizedEmail, name || null, language);

  return id;
}

router.get(
  "/projects/:id",
  validate({ params: projectParamsSchema }),
  (req, res) => {
    const project = getPublicProject(req.params.id);
    if (!project) {
      // Same answer whether the project is absent or simply not public, so this
      // endpoint cannot be used to enumerate private projects.
      return res.status(404).json({ error: "not_found" });
    }

    return res.json({
      id: project.id,
      name: project.name,
      custom_fields: customFieldsService.listDefinitions({ projectId: project.id })
    });
  }
);

router.post(
  "/intake",
  publicIntakeIpLimiter,
  publicIntakeEmailLimiter,
  validate({ body: intakeSchema }),
  async (req, res, next) => {
    try {
      const project = getPublicProject(req.body.project_id);
      if (!project) {
        return res.status(404).json({ error: "not_found" });
      }

      const language = normalizeLanguage(req.body.lang);
      const reporterId = findOrCreateReporter({
        email: req.body.email,
        name: req.body.name,
        language
      });

      const created = ticketsService.createTicket({
        user: { id: reporterId, role: "user" },
        payload: {
          title: req.body.title,
          description: req.body.description,
          urgency_reporter: "normal",
          category: "other",
          project_id: project.id,
          custom_fields: req.body.custom_fields
        },
        files: [],
        context: { actorUserId: reporterId, reporterId }
      });

      // createTicket returns an identifier plus telemetry, not the row, so the
      // human-facing number is read back.
      const ticketRow = db
        .prepare("SELECT number FROM tickets WHERE id = ?")
        .get(created.ticketId);
      const reference = `#${String(ticketRow.number).padStart(3, "0")}`;

      // Acknowledgement is best effort: the ticket exists either way, and
      // failing the request after a successful write would invite a duplicate.
      try {
        await sendEmail({
          to: req.body.email,
          lang: language,
          origin: req.resolvedOrigin,
          subject: translate(language, {
            pl: `Przyjęliśmy zgłoszenie ${reference}`,
            en: `We received your report ${reference}`,
            it: `Abbiamo ricevuto la tua segnalazione ${reference}`
          }),
          text: translate(language, {
            pl: `Dziękujemy. Twoje zgłoszenie ma numer ${reference}. Odezwiemy się na ten adres.`,
            en: `Thank you. Your report has the reference ${reference}. We will reply to this address.`,
            it: `Grazie. La tua segnalazione ha il riferimento ${reference}. Ti risponderemo a questo indirizzo.`
          })
        });
      } catch (emailError) {
        console.warn("[public-intake] acknowledgement failed", emailError.message);
      }

      // Only the reference goes back. The ticket body would let a submitter
      // confirm what was stored for an address that is not theirs.
      return res.status(201).json({ reference });
    } catch (error) {
      if (error instanceof CustomFieldError) {
        return res
          .status(400)
          .json({ error: error.code, field: error.field, message: error.message });
      }
      return next(error);
    }
  }
);

module.exports = router;
