"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiFetch } from "./api-client";

interface Membership {
  id: string;
  churchId: string;
  campusId: string | null;
  ministryId: string | null;
  role: string;
}

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  memberships: Membership[];
}

interface Session {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    churchName: string;
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Phase 1 note: tokens are kept in sessionStorage so a session survives a
// page refresh during development. Hardening pass before real launch should
// move the refresh token to an httpOnly cookie issued by the API so it's
// never reachable from JS at all (see docs/02-architecture.md §7).
const SESSION_KEY = "serveflow.session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? sessionStorage.getItem(SESSION_KEY) : null;
    if (raw) {
      try {
        setSession(JSON.parse(raw));
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
    setLoading(false);
  }, []);

  function persist(next: Session | null) {
    setSession(next);
    if (typeof window !== "undefined") {
      if (next) sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
      else sessionStorage.removeItem(SESSION_KEY);
    }
  }

  async function login(email: string, password: string) {
    const result = await apiFetch<Session>("/auth/login", { method: "POST", body: { email, password } });
    persist(result);
  }

  async function register(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    churchName: string;
  }) {
    const result = await apiFetch<Session>("/auth/register", { method: "POST", body: input });
    persist(result);
  }

  function logout() {
    persist(null);
  }

  return (
    <AuthContext.Provider value={{ session, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
