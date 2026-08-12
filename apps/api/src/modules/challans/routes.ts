import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, count, ilike } from "drizzle-orm";
import { db, schema } from "@erp/db";
import { createChallanSchema, updateChallanSchema, paginationQuerySchema } from "@erp/types";
import { requireAuth, requireRole } from "../../middleware/auth";
import { paginate, offsetFor } from "../../lib/pagination";
import * as challanService from "./service";
import { renderChallanPdf } from "./pdf";

export const challanRoutes = new Hono();
challanRoutes.use("*", requireAuth);

// GET /challans
challanRoutes.get("/", zValidator("query", paginationQuerySchema), async (c) => {
  const { page, limit, search } = c.req.valid("query");
  const status = c.req.query("status");
  const customerId = c.req.query("customerId");

  const conditions = [];
  if (search) conditions.push(ilike(schema.challans.challanNumber, `%${search}%`));
  if (status) conditions.push(eq(schema.challans.status, status as any));
  if (customerId) conditions.push(eq(schema.challans.customerId, customerId));
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, totalResult] = await Promise.all([
    db.select().from(schema.challans).where(where).orderBy(desc(schema.challans.createdAt)).limit(limit).offset(offsetFor(page, limit)),
    db.select({ value: count() }).from(schema.challans).where(where),
  ]);
  const total = totalResult[0]?.value ?? 0;

  return c.json(paginate(rows, total, page, limit));
});

// POST /challans  (admin, sales)
challanRoutes.post("/", requireRole("admin", "sales"), zValidator("json", createChallanSchema), async (c) => {
  const input = c.req.valid("json");
  const user = c.get("user");
  const created = await challanService.createChallan(input, user.id);
  return c.json({ data: created }, 201);
});

// GET /challans/:id
challanRoutes.get("/:id", async (c) => {
  const data = await challanService.getChallanWithItems(c.req.param("id"));
  return c.json({ data });
});

// PATCH /challans/:id  (admin, sales) — draft edits only
challanRoutes.patch("/:id", requireRole("admin", "sales"), zValidator("json", updateChallanSchema), async (c) => {
  const updated = await challanService.updateChallan(c.req.param("id"), c.req.valid("json"));
  return c.json({ data: updated });
});

// POST /challans/:id/confirm  (admin, sales)
challanRoutes.post("/:id/confirm", requireRole("admin", "sales"), async (c) => {
  const user = c.get("user");
  const updated = await challanService.confirmChallan(c.req.param("id"), user.id);
  return c.json({ data: updated });
});

// POST /challans/:id/cancel  (admin, sales)
challanRoutes.post("/:id/cancel", requireRole("admin", "sales"), async (c) => {
  const user = c.get("user");
  const updated = await challanService.cancelChallan(c.req.param("id"), user.id);
  return c.json({ data: updated });
});

// GET /challans/:id/pdf  (bonus — invoice/challan export)
challanRoutes.get("/:id/pdf", requireRole("admin", "sales", "accounts"), async (c) => {
  const challan = await challanService.getChallanWithItems(c.req.param("id"));
  const pdfBuffer = await renderChallanPdf(challan as any);
  c.header("Content-Type", "application/pdf");
  c.header("Content-Disposition", `inline; filename="${challan.challanNumber}.pdf"`);
  c.header("Content-Length", String(pdfBuffer.length));
  return c.body(pdfBuffer);
});
