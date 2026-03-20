import client from "./client";

export async function getTicketTemplates({ projectId, includeInactive } = {}) {
  const params = {};
  if (projectId) params.project_id = projectId;
  if (includeInactive) params.include_inactive = "1";
  const response = await client.get("/api/ticket-templates", { params });
  return response.data;
}

export async function getTicketTemplate(id) {
  const response = await client.get(`/api/ticket-templates/${id}`);
  return response.data;
}

export async function createTicketTemplate(payload) {
  const response = await client.post("/api/ticket-templates", payload);
  return response.data;
}

export async function patchTicketTemplate(id, payload) {
  const response = await client.patch(`/api/ticket-templates/${id}`, payload);
  return response.data;
}

export async function deleteTicketTemplate(id) {
  await client.delete(`/api/ticket-templates/${id}`);
}
