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
