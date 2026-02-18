import client from "./client";

export async function getDevTasks() {
  const response = await client.get("/api/dev-tasks");
  return response.data;
}
