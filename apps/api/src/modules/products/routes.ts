import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, ilike, lte, count, sql } from "drizzle-orm";
import { db, schema } from "@erp/db";
import {
  createProductSchema,
  updateProductSchema,
  createStockMovementSchema,
  paginationQuerySchema,
} from "@erp/types";
import { requireAuth, requireRole } from "../../middleware/auth";
import { notFound, conflict, badRequest } from "../../lib/errors";
import { paginate, offsetFor } from "../../lib/pagination";
import { getPresignedUploadUrl } from "../../lib/r2";

export const productRoutes = new Hono();
productRoutes.use("*", requireAuth);

// GET /products
productRoutes.get("/", zValidator("query", paginationQuerySchema), async (c) => {
  const { page, limit, search } = c.req.valid("query");
  const category = c.req.query("category");
  const lowStock = c.req.query("lowStock") === "true";

  const conditions = [];
  if (search) conditions.push(ilike(schema.products.name, `%${search}%`));
  if (category) conditions.push(eq(schema.products.category, category));
  if (lowStock) conditions.push(sql`${schema.products.currentStock} <= ${schema.products.minStockAlert}`);

  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ value: total }]] = await Promise.all([
    db.select().from(schema.products).where(where).orderBy(desc(schema.products.createdAt)).limit(limit).offset(offsetFor(page, limit)),
    db.select({ value: count() }).from(schema.products).where(where),
  ]);

  return c.json(paginate(rows, total, page, limit));
});

// POST /products  (admin, warehouse)
productRoutes.post("/", requireRole("admin", "warehouse"), zValidator("json", createProductSchema), async (c) => {
  const input = c.req.valid("json");

  const [existingSku] = await db.select().from(schema.products).where(eq(schema.products.sku, input.sku)).limit(1);
  if (existingSku) throw conflict("A product with this SKU already exists", { sku: "SKU must be unique" });

  const [created] = await db
    .insert(schema.products)
    .values({ ...input, unitPrice: String(input.unitPrice), location: input.location || null })
    .returning();
  return c.json({ data: created }, 201);
});

// GET /products/:id
productRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const [row] = await db.select().from(schema.products).where(eq(schema.products.id, id)).limit(1);
  if (!row) throw notFound("Product");
  return c.json({ data: row });
});

// PATCH /products/:id  (admin, warehouse)
productRoutes.patch("/:id", requireRole("admin", "warehouse"), zValidator("json", updateProductSchema), async (c) => {
  const id = c.req.param("id");
  const input = c.req.valid("json");
  const [existing] = await db.select().from(schema.products).where(eq(schema.products.id, id)).limit(1);
  if (!existing) throw notFound("Product");

  const [updated] = await db
    .update(schema.products)
    .set({ ...input, unitPrice: input.unitPrice !== undefined ? String(input.unitPrice) : undefined, updatedAt: new Date() })
    .where(eq(schema.products.id, id))
    .returning();
  return c.json({ data: updated });
});

// GET /products/:id/movements
productRoutes.get("/:id/movements", async (c) => {
  const id = c.req.param("id");
  const rows = await db
    .select()
    .from(schema.stockMovements)
    .where(eq(schema.stockMovements.productId, id))
    .orderBy(desc(schema.stockMovements.createdAt));
  return c.json({ data: rows });
});

// POST /products/:id/movements  (admin, warehouse) — manual stock adjustment
productRoutes.post("/:id/movements", requireRole("admin", "warehouse"), zValidator("json", createStockMovementSchema), async (c) => {
  const id = c.req.param("id");
  const { quantityChanged, movementType, reason } = c.req.valid("json");
  const user = c.get("user");

  const updated = await db.transaction(async (tx) => {
    const [product] = await tx
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, id))
      .for("update")
      .limit(1);
    if (!product) throw notFound("Product");

    const delta = movementType === "IN" ? quantityChanged : -quantityChanged;
    const newStock = product.currentStock + delta;
    if (newStock < 0) {
      throw conflict(`Insufficient stock. Current stock is ${product.currentStock}, cannot reduce by ${quantityChanged}.`);
    }

    const [updatedProduct] = await tx
      .update(schema.products)
      .set({ currentStock: newStock, updatedAt: new Date() })
      .where(eq(schema.products.id, id))
      .returning();

    await tx.insert(schema.stockMovements).values({
      productId: id,
      quantityChanged,
      movementType,
      reason,
      referenceType: "manual",
      createdBy: user.id,
    });

    return updatedProduct;
  });

  return c.json({ data: updated }, 201);
});

// POST /products/:id/image-upload-url — presigned R2 upload
productRoutes.post("/:id/image-upload-url", requireRole("admin", "warehouse"), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ contentType: string; extension: string }>();
  if (!body?.contentType?.startsWith("image/")) throw badRequest("Only image uploads are allowed");

  const [product] = await db.select().from(schema.products).where(eq(schema.products.id, id)).limit(1);
  if (!product) throw notFound("Product");

  const key = `products/${id}/${crypto.randomUUID()}.${body.extension || "jpg"}`;
  const { uploadUrl, publicUrl } = await getPresignedUploadUrl(key, body.contentType);
  return c.json({ uploadUrl, publicUrl });
});

// PATCH /products/:id/image — confirm upload, persist URL
productRoutes.patch("/:id/image", requireRole("admin", "warehouse"), async (c) => {
  const id = c.req.param("id");
  const { imageUrl } = await c.req.json<{ imageUrl: string }>();
  const [updated] = await db
    .update(schema.products)
    .set({ imageUrl, updatedAt: new Date() })
    .where(eq(schema.products.id, id))
    .returning();
  if (!updated) throw notFound("Product");
  return c.json({ data: updated });
});
