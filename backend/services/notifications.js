const db = require("../db");
const { sendEmail } = require("./email");
const { STATUS_NOTIFICATION_KEYS } = require("../constants");
const { getSetting } = require("./settings");
const { canonicalOrigin } = require("../config");
const { normalizeLanguage, translate } = require("../core/languages");

function getUser(userId) {
  return db
    .prepare(
      `SELECT
        id, email, name, role, language,
        email_notify_ticket_status, email_notify_developer_comment
       FROM users
       WHERE id = ?`
    )
    .get(userId);
}

function getTicket(ticketId) {
  return db
    .prepare("SELECT id, number, title, reporter_id, status FROM tickets WHERE id = ?")
    .get(ticketId);
}

function formatTicketNumber(number) {
  return `#${String(number).padStart(3, "0")}`;
}

// Deliberately canonical, not request-derived. A notification is triggered by
// one person and delivered to another, and we do not record which host the
// RECIPIENT uses — so the actor's host would be a guess about someone else.
function getTicketUrl(ticketId) {
  const appUrl = getSetting("app_url", canonicalOrigin);
  return `${appUrl.replace(/\/$/, "")}/ticket/${ticketId}`;
}

function t(lang, translations) {
  return translate(lang, translations);
}

async function notifyReporterStatusChange({ ticketId, actorUserId, oldStatus, newStatus }) {
  if (!STATUS_NOTIFICATION_KEYS.has(newStatus) || oldStatus === newStatus) {
    return { sent: false, reason: "status_not_notifiable" };
  }

  const ticket = getTicket(ticketId);
  if (!ticket) {
    return { sent: false, reason: "ticket_not_found" };
  }

  if (ticket.reporter_id === actorUserId) {
    return { sent: false, reason: "actor_is_reporter" };
  }

  const reporter = getUser(ticket.reporter_id);
  if (!reporter || !reporter.email) {
    return { sent: false, reason: "reporter_not_found" };
  }

  if (!reporter.email_notify_ticket_status) {
    return { sent: false, reason: "ticket_status_disabled_by_user" };
  }

  const labels = {
    pl: {
      verified: "Zweryfikowane",
      in_progress: "W realizacji",
      waiting: "Oczekujące",
      blocked: "Zablokowane",
      closed: "Zamknięte"
    },
    en: {
      verified: "Verified",
      in_progress: "In Progress",
      waiting: "Waiting",
      blocked: "Blocked",
      closed: "Closed"
    },
    it: {
      verified: "Verificato",
      in_progress: "In corso",
      waiting: "In attesa",
      blocked: "Bloccato",
      closed: "Chiuso"
    }
  };

  const lang = normalizeLanguage(reporter.language);
  const subject = t(lang, {
    pl: `Aktualizacja zgłoszenia ${formatTicketNumber(ticket.number)}`,
    en: `Ticket update ${formatTicketNumber(ticket.number)}`,
    it: `Aggiornamento del ticket ${formatTicketNumber(ticket.number)}`
  });
  const statusLabel = labels[lang][newStatus] || newStatus;
  const text = t(lang, {
    pl: `Status zgłoszenia ${formatTicketNumber(ticket.number)} (${ticket.title}) zmienił się na: ${statusLabel}.\n${getTicketUrl(ticket.id)}`,
    en: `The status of ticket ${formatTicketNumber(ticket.number)} (${ticket.title}) changed to: ${statusLabel}.\n${getTicketUrl(ticket.id)}`,
    it: `Lo stato del ticket ${formatTicketNumber(ticket.number)} (${ticket.title}) è cambiato in: ${statusLabel}.\n${getTicketUrl(ticket.id)}`
  });

  await sendEmail({ to: reporter.email, subject, text, lang });
  return { sent: true };
}

async function notifyReporterDeveloperComment({ ticketId, actorUserId, commentContent }) {
  const ticket = getTicket(ticketId);
  if (!ticket) {
    return { sent: false, reason: "ticket_not_found" };
  }

  if (ticket.reporter_id === actorUserId) {
    return { sent: false, reason: "actor_is_reporter" };
  }

  const reporter = getUser(ticket.reporter_id);
  if (!reporter || !reporter.email) {
    return { sent: false, reason: "reporter_not_found" };
  }

  if (!reporter.email_notify_developer_comment) {
    return { sent: false, reason: "developer_comment_disabled_by_user" };
  }

  const lang = normalizeLanguage(reporter.language);
  const subject = t(lang, {
    pl: `Nowy komentarz developera ${formatTicketNumber(ticket.number)}`,
    en: `New developer comment ${formatTicketNumber(ticket.number)}`,
    it: `Nuovo commento dello sviluppatore ${formatTicketNumber(ticket.number)}`
  });
  const text = t(lang, {
    pl: `Developer dodał komentarz do zgłoszenia ${formatTicketNumber(ticket.number)} (${ticket.title}).\n\n${commentContent}\n\n${getTicketUrl(ticket.id)}`,
    en: `A developer posted a comment on ticket ${formatTicketNumber(ticket.number)} (${ticket.title}).\n\n${commentContent}\n\n${getTicketUrl(ticket.id)}`,
    it: `Uno sviluppatore ha aggiunto un commento al ticket ${formatTicketNumber(ticket.number)} (${ticket.title}).\n\n${commentContent}\n\n${getTicketUrl(ticket.id)}`
  });

  await sendEmail({ to: reporter.email, subject, text, lang });
  return { sent: true };
}

module.exports = {
  notifyReporterStatusChange,
  notifyReporterDeveloperComment,
  formatTicketNumber
};
