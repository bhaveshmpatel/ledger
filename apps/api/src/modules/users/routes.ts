import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { desc, eq, count } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, schema } from "@erp/db";
import { createUserSchema, updateUserSchema, paginationQuerySchema } from "@erp/types";
import { requireAuth, requireRole } from "../../middleware/auth";
import { notFound, conflict } from "../../lib/errors";
import { paginate, offsetFor } from "../../lib/pagination";

export const userRoutes = new Hono();

// All user management is admin-only — applied at router level for every route
userRoutes.use("*", requireAuth, requireRole("admin"));

// GET /users
userRoutes.get("/", zValidator("query", paginationQuerySchema), async (c) => {
  const { page, limit } = c.req.valid("query");

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        role: schema.users.role,
        isActive: schema.users.isActive,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .orderBy(desc(schema.users.createdAt))
      .limit(limit)
      .offset(offsetFor(page, limit)),
    db.select({ value: count() }).from(schema.users),
  ]);

  return c.json(paginate(rows, total, page, limit));
});

// GET /users/:id
userRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [row] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      isActive: schema.users.isActive,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);

  if (!row) throw notFound("User");
  return c.json({ data: row });
});

// POST /users  — create a new user
userRoutes.post("/", zValidator("json", createUserSchema), async (c) => {
  const { name, email, password, role } = c.req.valid("json");

  // Unique email check
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  if (existing) throw conflict("A user with this email already exists", { email: "Email is already taken" });

  const passwordHash = await bcrypt.hash(password, 12);

  const [created] = await db
    .insert(schema.users)
    .values({ name, email, passwordHash, role })
    .returning({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      isActive: schema.users.isActive,
      createdAt: schema.users.createdAt,
    });

  return c.json({ data: created }, 201);
});

// PATCH /users/:id  — update name, email, role, isActive, or reset password
userRoutes.patch("/:id", zValidator("json", updateUserSchema), async (c) => {
  const id = c.req.param("id");
  const input = c.req.valid("json");
  const requestingUser = c.get("user");

  const [existing] = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);
  if (!existing) throw notFound("User");

  // Prevent an admin from deactivating or changing their own role
  if (id === requestingUser.id) {
    if (input.isActive === false) {
      throw conflict("You cannot deactivate your own account");
    }
    if (input.role && input.role !== requestingUser.role) {
      throw conflict("You cannot change your own role");
    }
  }

  // Unique email check if changing email
  if (input.email && input.email !== existing.email) {
    const [dup] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, input.email))
      .limit(1);
    if (dup) throw conflict("A user with this email already exists", { email: "Email is already taken" });
  }

  const updatePayload: Record<string, unknown> = {};
  if (input.name)     updatePayload.name     = input.name;
  if (input.email)    updatePayload.email    = input.email;
  if (input.role)     updatePayload.role     = input.role;
  if (input.isActive !== undefined) updatePayload.isActive = input.isActive;
  if (input.password) updatePayload.passwordHash = await bcrypt.hash(input.password, 12);

  const [updated] = await db
    .update(schema.users)
    .set(updatePayload)
    .where(eq(schema.users.id, id))
    .returning({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      role: schema.users.role,
      isActive: schema.users.isActive,
      createdAt: schema.users.createdAt,
    });

  return c.json({ data: updated });
});

// DELETE /users/:id  — hard delete (use deactivate for soft approach)
userRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const requestingUser = c.get("user");

  if (id === requestingUser.id) throw conflict("You cannot delete your own account");

  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);
  if (!existing) throw notFound("User");

  await db.delete(schema.users).where(eq(schema.users.id, id));
  return c.json({ data: { deleted: true } });
});
