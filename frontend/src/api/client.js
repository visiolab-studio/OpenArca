import axios from "axios";
import { getStoredValue, removeStoredValue, setStoredValue } from "../utils/storage";

export const TOKEN_KEY = "edudoroit_supportcenter_token";
// A production build talks to the SAME ORIGIN it was served from, so one bundle
// works under every host in ALLOWED_HOSTS. Baking an absolute URL in at build
// time would pin the bundle to one hostname and quietly defeat multi-host.
// The dev server runs on a different port than the API, so it needs the explicit
// default; VITE_API_URL still overrides either way.
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:4000" : "");

let authToken = getStoredValue(TOKEN_KEY, null);

export function setAuthToken(token) {
  authToken = token;
  if (token) {
    setStoredValue(TOKEN_KEY, token);
  } else {
    removeStoredValue(TOKEN_KEY);
  }
}

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000
});

client.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

export default client;
