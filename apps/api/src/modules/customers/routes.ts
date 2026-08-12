import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, ilike, or, count } from "drizzle-orm";
import { db, schema } from "@erp/db";
import {
  createCustomerSchema,
  updateCustomerSchema,
  createCustomerNoteSchema,
  paginationQuerySchema,
} from "@erp/types";
import { requireAuth, requireRole } from "../../middleware/auth";
import { notFound } from "../../lib/errors";
import { paginate, offsetFor } from "../../lib/pagination";

export const customerRoutes = new Hono();
customerRoutes.use("*", requireAuth);

// GET /customers
customerRoutes.get("/", zValidator("query", paginationQuerySchema.extend({})), async (c) => {
  const { page, limit, search } = c.req.valid("query");
  const status = c.req.query("status");
  const type = c.req.query("type");

  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(schema.customers.name, `%${search}%`),
        ilike(schema.customers.businessName, `%${search}%`),
        ilike(schema.customers.mobile, `%${search}%`)
      )
    );
  }
  if (status) conditions.push(eq(schema.customers.status, status as any));
  if (type) conditions.push(eq(schema.customers.customerType, type as any));

  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, totalResult] = await Promise.all([
    db.select().from(schema.customers).where(where).orderBy(desc(schema.customers.createdAt)).limit(limit).offset(offsetFor(page, limit)),
    db.select({ value: count() }).from(schema.customers).where(where),
  ]);
  const total = totalResult[0]?.value ?? 0;

  return c.json(paginate(rows, total, page, limit));
});

// POST /customers  (admin, sales)
customerRoutes.post("/", requireRole("admin", "sales"), zValidator("json", createCustomerSchema), async (c) => {
  const input = c.req.valid("json");
  const user = c.get("user");
  const [created] = await db
    .insert(schema.customers)
    .values({
      ...input,
      email: input.email || null,
      gstNumber: input.gstNumber || null,
      followUpDate: input.followUpDate || null,
      createdBy: user.id,
    })
    .returning();
  return c.json({ data: created }, 201);
});

// GET /customers/:id
customerRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [row] = await db.select().from(schema.customers).where(eq(schema.customers.id, id)).limit(1);
  if (!row) throw notFound("Customer");
  return c.json({ data: row });
});

// PATCH /customers/:id  (admin, sales)
customerRoutes.patch("/:id", requireRole("admin", "sales"), zValidator("json", updateCustomerSchema), async (c) => {
  const id = c.req.param("id");
  const input = c.req.valid("json");
  const [existing] = await db.select().from(schema.customers).where(eq(schema.customers.id, id)).limit(1);
  if (!existing) throw notFound("Customer");

  const [updated] = await db
    .update(schema.customers)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(schema.customers.id, id))
    .returning();
  return c.json({ data: updated });
});

// GET /customers/:id/notes
customerRoutes.get("/:id/notes", async (c) => {
  const id = c.req.param("id");
  const rows = await db
    .select()
    .from(schema.customerNotes)
    .where(eq(schema.customerNotes.customerId, id))
    .orderBy(desc(schema.customerNotes.createdAt));
  return c.json({ data: rows });
});

// POST /customers/:id/notes  (admin, sales)
customerRoutes.post("/:id/notes", requireRole("admin", "sales"), zValidator("json", createCustomerNoteSchema), async (c) => {
  const id = c.req.param("id");
  const { note } = c.req.valid("json");
  const user = c.get("user");

  const [existing] = await db.select().from(schema.customers).where(eq(schema.customers.id, id)).limit(1);
  if (!existing) throw notFound("Customer");

  const [created] = await db
    .insert(schema.customerNotes)
    .values({ customerId: id, note, createdBy: user.id })
    .returning();
  return c.json({ data: created }, 201);
});
