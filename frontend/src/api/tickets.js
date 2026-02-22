import client from "./client";

export async function getTickets(params = {}) {
  const response = await client.get("/api/tickets", { params });
  return response.data;
}

export async function getBoard() {
  const response = await client.get("/api/tickets/board");
  return response.data;
}

export async function getOverviewStats() {
  const response = await client.get("/api/tickets/stats/overview");
  return response.data;
}

export async function getOverviewWorkload() {
  const response = await client.get("/api/tickets/workload");
  return response.data;
}

export async function getTicket(id) {
  const response = await client.get(`/api/tickets/${id}`);
  return response.data;
}

export async function createTicket(formData) {
  const response = await client.post("/api/tickets", formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return response.data;
}

export async function patchTicket(id, payload) {
  const response = await client.patch(`/api/tickets/${id}`, payload);
  return response.data;
}

export async function addComment(id, payload) {
  const response = await client.post(`/api/tickets/${id}/comments`, payload);
  return response.data;
}

export async function addAttachments(id, files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("attachments", file);
  }
  const response = await client.post(`/api/tickets/${id}/attachments`, formData, {
    headers: { "Content-Type": "multipart/form-data" }
  });
  return response.data;
}
