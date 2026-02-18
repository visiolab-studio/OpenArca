import client from "./client";

export async function getSettings() {
  const response = await client.get("/api/settings");
  return response.data;
}

export async function patchSettings(payload) {
  const response = await client.patch("/api/settings", payload);
  return response.data;
}

export async function testSmtp(payload) {
  const response = await client.post("/api/settings/test-smtp", payload);
  return response.data;
}
