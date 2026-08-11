"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthUser } from "@erp/types";
import { api, ApiClientError } from "@/lib/api";
import { AuthContext } from "@/lib/auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const tryRefresh = useCallback(async () => {
    try {
      const res = await api.post<{ user: AuthUser; accessToken: string }>("/auth/refresh");
      setUser(res.user);
      setAccessToken(res.accessToken);
    } catch {
      setUser(null);
      setAccessToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    tryRefresh();
  }, [tryRefresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<{ user: AuthUser; accessToken: string }>("/auth/login", { email, password });
      setUser(res.user);
      setAccessToken(res.accessToken);
      router.push("/dashboard");
    },
    [router]
  );

  const logout = useCallback(async () => {
    await api.post("/auth/logout").catch(() => {});
    setUser(null);
    setAccessToken(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, loading }}>{children}</AuthContext.Provider>
  );
}
