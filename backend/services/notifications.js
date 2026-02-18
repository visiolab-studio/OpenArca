const db = require("../db");
const { sendEmail } = require("./email");
const { STATUS_NOTIFICATION_KEYS } = require("../constants");
const { getSetting } = require("./settings");

function getUser(userId) {
  return db
    .prepare("SELECT id, email, name, role, language FROM users WHERE id = ?")
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

function getTicketUrl(ticketId) {
  const appUrl = getSetting("app_url", "http://localhost:3000");
  return `${appUrl.replace(/\/$/, "")}/ticket/${ticketId}`;
}

function t(lang, pl, en) {
  return lang === "en" ? en : pl;
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
    }
  };

  const lang = reporter.language === "en" ? "en" : "pl";
  const subject = t(
    lang,
    `Aktualizacja zgłoszenia ${formatTicketNumber(ticket.number)}`,
    `Ticket update ${formatTicketNumber(ticket.number)}`
  );
  const statusLabel = labels[lang][newStatus] || newStatus;
  const text = t(
    lang,
    `Status zgłoszenia ${formatTicketNumber(ticket.number)} (${ticket.title}) zmienił się na: ${statusLabel}.\n${getTicketUrl(ticket.id)}`,
    `The status of ticket ${formatTicketNumber(ticket.number)} (${ticket.title}) changed to: ${statusLabel}.\n${getTicketUrl(ticket.id)}`
  );

  await sendEmail({ to: reporter.email, subject, text });
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

  const lang = reporter.language === "en" ? "en" : "pl";
  const subject = t(
    lang,
    `Nowy komentarz developera ${formatTicketNumber(ticket.number)}`,
    `New developer comment ${formatTicketNumber(ticket.number)}`
  );
  const text = t(
    lang,
    `Developer dodał komentarz do zgłoszenia ${formatTicketNumber(ticket.number)} (${ticket.title}).\n\n${commentContent}\n\n${getTicketUrl(ticket.id)}`,
    `A developer posted a comment on ticket ${formatTicketNumber(ticket.number)} (${ticket.title}).\n\n${commentContent}\n\n${getTicketUrl(ticket.id)}`
  );

  await sendEmail({ to: reporter.email, subject, text });
  return { sent: true };
}

module.exports = {
  notifyReporterStatusChange,
  notifyReporterDeveloperComment,
  formatTicketNumber
};
