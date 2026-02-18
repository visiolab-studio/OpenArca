import client from "./client";

export async function getDevTasks() {
  const response = await client.get("/api/dev-tasks");
  return response.data;
}

export async function createDevTask(payload) {
  const response = await client.post("/api/dev-tasks", payload);
  return response.data;
}

export async function patchDevTask(id, payload) {
  const response = await client.patch(`/api/dev-tasks/${id}`, payload);
  return response.data;
}

export async function deleteDevTask(id) {
  await client.delete(`/api/dev-tasks/${id}`);
}

export async function reorderDevTasks(order) {
  const response = await client.post("/api/dev-tasks/reorder", { order });
  return response.data;
}
