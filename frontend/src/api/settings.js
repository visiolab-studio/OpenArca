import client from "./client";

export async function getSettings() {
  const response = await client.get("/api/settings");
  return response.data;
}

export async function getPublicSettings() {
  const response = await client.get("/api/settings/public");
  return response.data;
}

export async function getCapabilities() {
  const response = await client.get("/api/settings/capabilities");
  return response.data;
}

export async function patchSettings(payload) {
  const response = await client.patch("/api/settings", payload);
  return response.data;
}

export async function uploadAppLogo(file) {
  const formData = new FormData();
  formData.append("logo", file);
  const response = await client.post("/api/settings/logo", formData);
  return response.data;
}

export async function testEmail(payload) {
  const response = await client.post("/api/settings/test-email", payload);
  return response.data;
}

export async function testSmtp(payload) {
  return testEmail(payload);
}
