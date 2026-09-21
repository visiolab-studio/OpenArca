import client from "./client";

export async function getServiceAccounts() {
  const response = await client.get("/api/service-accounts");
  return response.data;
}

export async function createServiceAccount(payload) {
  const response = await client.post("/api/service-accounts", payload);
  return response.data;
}

export async function disableServiceAccount(id) {
  const response = await client.post(`/api/service-accounts/${id}/disable`);
  return response.data;
}

export async function revokeServiceAccount(id) {
  const response = await client.post(`/api/service-accounts/${id}/revoke`);
  return response.data;
}
