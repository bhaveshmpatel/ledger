"use client";

import { createContext, useContext } from "react";
import type { AuthUser } from "@erp/types";

export interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Role capability helpers — mirrors the role matrix in prompt.md §3 */
export const can = {
  manageUsers:     (role?: string) => role === "admin",
  manageCustomers: (role?: string) => role === "admin" || role === "sales",
  manageProducts:  (role?: string) => role === "admin" || role === "warehouse",
  adjustStock:     (role?: string) => role === "admin" || role === "warehouse",
  manageChallans:  (role?: string) => role === "admin" || role === "sales",
  exportInvoice:   (role?: string) => role === "admin" || role === "sales" || role === "accounts",
};
