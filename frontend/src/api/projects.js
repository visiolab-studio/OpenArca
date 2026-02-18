import client from "./client";

export async function getProjects() {
  const response = await client.get("/api/projects");
  return response.data;
}

export async function createProject(payload) {
  const response = await client.post("/api/projects", payload);
  return response.data;
}

export async function patchProject(id, payload) {
  const response = await client.patch(`/api/projects/${id}`, payload);
  return response.data;
}

export async function deleteProject(id) {
  await client.delete(`/api/projects/${id}`);
}
