import client from "./client";

export async function getProjects() {
  const response = await client.get("/api/projects");
  return response.data;
}
