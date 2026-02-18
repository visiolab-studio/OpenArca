import client from "./client";

export async function requestOtp(payload) {
  const response = await client.post("/api/auth/request-otp", payload);
  return response.data;
}

export async function verifyOtp(payload) {
  const response = await client.post("/api/auth/verify-otp", payload);
  return response.data;
}

export async function me() {
  const response = await client.get("/api/auth/me");
  return response.data;
}

export async function patchMe(payload) {
  const response = await client.patch("/api/auth/me", payload);
  return response.data;
}
