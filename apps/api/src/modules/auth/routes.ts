import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "@erp/db";
import { loginSchema, type AuthUser } from "@erp/types";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt";
import { unauthorized } from "../../lib/errors";
import { requireAuth } from "../../middleware/auth";

export const authRoutes = new Hono();

function toAuthUser(u: typeof schema.users.$inferSelect): AuthUser {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

authRoutes.post("/login", zValidator("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");

  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (!user || !user.isActive) throw unauthorized("Invalid email or password");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw unauthorized("Invalid email or password");

  const authUser = toAuthUser(user);
  const accessToken = signAccessToken(authUser);
  const refreshToken = signRefreshToken(user.id);

  setCookie(c, "refresh_token", refreshToken, {
    httpOnly: true,
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return c.json({ user: authUser, accessToken });
});

authRoutes.post("/refresh", async (c) => {
  const token = getCookie(c, "refresh_token");
  if (!token) throw unauthorized("No refresh token");

  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw unauthorized("Refresh token expired, please log in again");
  }

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, payload.sub)).limit(1);
  if (!user || !user.isActive) throw unauthorized();

  const authUser = toAuthUser(user);
  const accessToken = signAccessToken(authUser);
  return c.json({ user: authUser, accessToken });
});

authRoutes.post("/logout", async (c) => {
  deleteCookie(c, "refresh_token", { path: "/" });
  return c.json({ success: true });
});

authRoutes.get("/me", requireAuth, async (c) => {
  return c.json({ user: c.get("user") });
});
