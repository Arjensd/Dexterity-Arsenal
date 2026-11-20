"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, tokenStore } from "./api";
import type { Role, User } from "./types";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { name: string; email: string; phone?: string; password: string; role: "LEARNER" | "INSTRUCTOR"; headline?: string; skills?: string[] }) => Promise<User>;
  logout: () => void;
  switchRole: (role: "LEARNER" | "INSTRUCTOR") => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenStore.get()) { setLoading(false); return; }
    api<User>("/auth/me").then(setUser).catch(() => tokenStore.clear()).finally(() => setLoading(false));
  }, []);

  const login: AuthCtx["login"] = useCallback(async (email, password) => {
    const r = await api<{ user: User; token: string }>("/auth/login", { method: "POST", body: { email, password } });
    tokenStore.set(r.token); setUser(r.user); return r.user;
  }, []);
  const register: AuthCtx["register"] = useCallback(async (data) => {
    const r = await api<{ user: User; token: string }>("/auth/register", { method: "POST", body: data });
    tokenStore.set(r.token); setUser(r.user); return r.user;
  }, []);
  const logout = useCallback(() => { tokenStore.clear(); setUser(null); }, []);
  const switchRole = useCallback(async (role: "LEARNER" | "INSTRUCTOR") => {
    setUser(await api<User>("/auth/role", { method: "PATCH", body: { role } }));
  }, []);

  return <Ctx.Provider value={{ user, loading, login, register, logout, switchRole }}>{children}</Ctx.Provider>;
}

/** Redirects to /login (remembering where you were) when signed out. */
export function useRequireAuth(roles?: Role[]) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(path)}`);
    else if (roles && !roles.includes(user.role)) router.replace("/");
  }, [user, loading, router, path, roles]);
  return { user, ready: !loading && !!user && (!roles || roles.includes(user.role)) };
}
