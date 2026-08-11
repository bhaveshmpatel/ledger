import { z } from "zod";

export const ROLES = ["admin", "sales", "warehouse", "accounts"] as const;
export type Role = (typeof ROLES)[number];

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const authUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(ROLES),
});
export type AuthUser = z.infer<typeof authUserSchema>;
