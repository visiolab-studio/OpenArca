const { ticketsService } = require("../../services/tickets");

function createTicketService() {
  return {
    provider: "core",

    createTicketForExtension({ actorUser, reporterId, payload, files, sourceSupportThreadId }) {
      return ticketsService.createTicket({
        user: actorUser,
        payload,
        files,
        context: {
          actorUserId: actorUser?.id,
          reporterId,
          sourceSupportThreadId
        }
      });
    },

    updateTicketForExtension({ actorUser, ticketId, payload }) {
      return ticketsService.updateTicket({
        ticketId,
        user: actorUser,
        rawPayload: payload
      });
    },

    // A draft comment is released or dropped by a HUMAN, and a layer may need
    // to wrap that decision with its own audit trail — core knows nothing of a
    // layer's compliance log, so the state change and that log entry have to
    // happen in one call. Exposed here rather than left to the route, because
    // a layer holds a service, not an HTTP client to its own process.
    publishTicketCommentForExtension({ actorUser, ticketId, commentId }) {
      return ticketsService.publishTicketComment({ ticketId, commentId, user: actorUser });
    },

    discardTicketCommentForExtension({ actorUser, ticketId, commentId }) {
      return ticketsService.discardTicketComment({ ticketId, commentId, user: actorUser });
    },

    getTicketDetailForExtension({ user, ticketId }) {
      return ticketsService.getTicketDetail({
        ticketId,
        user
      });
    }
  };
}

module.exports = {
  createTicketService
};
