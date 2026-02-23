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

export async function getRelatedTickets(id) {
  const response = await client.get(`/api/tickets/${id}/related`);
  return response.data;
}

export async function addRelatedTicket(id, payload) {
  const response = await client.post(`/api/tickets/${id}/related`, payload);
  return response.data;
}

export async function deleteRelatedTicket(id, relatedId) {
  await client.delete(`/api/tickets/${id}/related/${relatedId}`);
}

export async function getExternalReferences(id) {
  const response = await client.get(`/api/tickets/${id}/external-references`);
  return response.data;
}

export async function addExternalReference(id, payload) {
  const response = await client.post(`/api/tickets/${id}/external-references`, payload);
  return response.data;
}

export async function deleteExternalReference(id, refId) {
  await client.delete(`/api/tickets/${id}/external-references/${refId}`);
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
