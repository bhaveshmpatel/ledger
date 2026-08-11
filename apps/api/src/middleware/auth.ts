import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { verifyAccessToken } from "../lib/jwt";
import { unauthorized, forbidden } from "../lib/errors";
import type { AuthUser, Role } from "@erp/types";

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

export async function requireAuth(c: Context, next: Next) {
  const header = c.req.header("Authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const token = bearer ?? getCookie(c, "access_token");

  if (!token) throw unauthorized();

  try {
    const user = verifyAccessToken(token);
    c.set("user", user);
    await next();
  } catch {
    throw unauthorized("Invalid or expired session");
  }
}

export function requireRole(...roles: Role[]) {
  return async (c: Context, next: Next) => {
    const user = c.get("user");
    if (!user || !roles.includes(user.role)) {
      throw forbidden(`This action requires one of these roles: ${roles.join(", ")}`);
    }
    await next();
  };
}
