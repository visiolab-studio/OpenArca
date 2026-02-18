import client from "./client";

export async function getUsers() {
  const response = await client.get("/api/users");
  return response.data;
}

export async function patchUser(id, payload) {
  const response = await client.patch(`/api/users/${id}`, payload);
  return response.data;
}
