import { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as authApi from "../api/auth";
import { setAuthToken, TOKEN_KEY } from "../api/client";

const AuthContext = createContext(null);

function normalizeApiError(error) {
  return error?.response?.data?.error || error?.message || "internal_error";
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!token) {
        setReady(true);
        return;
      }

      try {
        setAuthToken(token);
        const currentUser = await authApi.me();
        if (active) {
          setUser(currentUser);
        }
      } catch (_error) {
        if (active) {
          setAuthToken(null);
          setToken(null);
          setUser(null);
        }
      } finally {
        if (active) {
          setReady(true);
        }
      }
    }

    bootstrap();
    return () => {
      active = false;
    };
  }, [token]);

  async function requestOtp(email, lang) {
    try {
      return await authApi.requestOtp({ email, lang });
    } catch (error) {
      throw new Error(normalizeApiError(error));
    }
  }

  async function verifyOtp(email, code) {
    try {
      const response = await authApi.verifyOtp({ email, code });
      setAuthToken(response.token);
      setToken(response.token);
      setUser(response.user);
      return response;
    } catch (error) {
      throw new Error(normalizeApiError(error));
    }
  }

  async function refreshMe() {
    try {
      const currentUser = await authApi.me();
      setUser(currentUser);
      return currentUser;
    } catch (error) {
      throw new Error(normalizeApiError(error));
    }
  }

  async function updateProfile(payload) {
    try {
      const updatedUser = await authApi.patchMe(payload);
      setUser(updatedUser);
      return updatedUser;
    } catch (error) {
      throw new Error(normalizeApiError(error));
    }
  }

  function logout() {
    setAuthToken(null);
    setToken(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({
      user,
      token,
      ready,
      isAuthenticated: Boolean(token && user),
      isDeveloper: user?.role === "developer",
      requestOtp,
      verifyOtp,
      refreshMe,
      updateProfile,
      logout
    }),
    [user, token, ready]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
