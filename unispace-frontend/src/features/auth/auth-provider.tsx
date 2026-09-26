"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { ApiError, apiRequest, downloadApiFile, fetchApiFile, type ApiFile } from "@/lib/api/client";

export type UserRole = "USER" | "STAFF" | "ADMIN";
export type AccountStatus = "PENDING_VERIFICATION" | "ACTIVE" | "REJECTED" | "NONACTIVE";

export type AuthUser = {
  id: string;
  name: string;
  identityNumber: string;
  email: string;
  role: UserRole;
  accountStatus: AccountStatus;
};

type AuthSession = {
  accessToken: string;
  user: AuthUser;
};

type AuthRequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown> | null;
};

type AuthContextValue = {
  isReady: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  replaceSession: (session: AuthSession) => void;
  download: (path: string, options?: AuthRequestOptions) => Promise<ApiFile>;
  fetchFile: (path: string, options?: AuthRequestOptions) => Promise<ApiFile>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  request: <T>(path: string, options?: AuthRequestOptions) => Promise<T>;
  user: AuthUser | null;
};

export type RegisterInput = {
  name: string;
  identityNumber: string;
  email: string;
  password: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

let refreshInFlight: Promise<AuthSession> | null = null;

async function refreshSession() {
  return apiRequest<AuthSession>("/auth/refresh", { method: "POST" });
}

function refreshSessionOnce() {
  if (!refreshInFlight) {
    refreshInFlight = refreshSession().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    refreshSessionOnce()
      .then((nextSession) => {
        if (isMounted) setSession(nextSession);
      })
      .catch(() => undefined)
      .finally(() => {
        if (isMounted) setIsReady(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const nextSession = await apiRequest<AuthSession>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setSession(nextSession);
    return nextSession.user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    return apiRequest<AuthUser>("/auth/register", { method: "POST", body: input });
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest<{ loggedOut: boolean }>("/auth/logout", { method: "POST" });
    } finally {
      setSession(null);
    }
  }, []);

  const replaceSession = useCallback((nextSession: AuthSession) => {
    setSession(nextSession);
  }, []);

  const request = useCallback<AuthContextValue["request"]>(
    async (path, options = {}) => {
      try {
        return await apiRequest(path, { ...options, accessToken: session?.accessToken });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;

        try {
          const refreshedSession = await refreshSessionOnce();
          setSession(refreshedSession);
          return apiRequest(path, { ...options, accessToken: refreshedSession.accessToken });
        } catch (refreshError) {
          setSession(null);
          throw refreshError;
        }
      }
    },
    [session],
  );

  const fetchFile = useCallback<AuthContextValue["fetchFile"]>(
    async (path, options = {}) => {
      try {
        return await fetchApiFile(path, { ...options, accessToken: session?.accessToken });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        const refreshedSession = await refreshSessionOnce();
        setSession(refreshedSession);
        return fetchApiFile(path, { ...options, accessToken: refreshedSession.accessToken });
      }
    },
    [session],
  );

  const download = useCallback<AuthContextValue["download"]>(
    async (path, options = {}) => {
      try {
        return await downloadApiFile(path, { ...options, accessToken: session?.accessToken });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        const refreshedSession = await refreshSessionOnce();
        setSession(refreshedSession);
        return downloadApiFile(path, { ...options, accessToken: refreshedSession.accessToken });
      }
    },
    [session],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ isReady, login, logout, replaceSession, register, request, fetchFile, download, user: session?.user ?? null }),
    [download, fetchFile, isReady, login, logout, replaceSession, register, request, session?.user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
