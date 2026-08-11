import { Hono } from "hono";
import { desc, eq, sql, count } from "drizzle-orm";
import { db, schema } from "@erp/db";
import { requireAuth } from "../../middleware/auth";

export const dashboardRoutes = new Hono();
dashboardRoutes.use("*", requireAuth);

dashboardRoutes.get("/summary", async (c) => {
  const [[{ value: customerCount }], [{ value: productCount }], [{ value: draftChallans }], [{ value: confirmedChallans }]] =
    await Promise.all([
      db.select({ value: count() }).from(schema.customers),
      db.select({ value: count() }).from(schema.products),
      db.select({ value: count() }).from(schema.challans).where(eq(schema.challans.status, "draft")),
      db.select({ value: count() }).from(schema.challans).where(eq(schema.challans.status, "confirmed")),
    ]);

  const lowStock = await db
    .select()
    .from(schema.products)
    .where(sql`${schema.products.currentStock} <= ${schema.products.minStockAlert}`)
    .orderBy(schema.products.currentStock)
    .limit(10);

  const recentChallans = await db.select().from(schema.challans).orderBy(desc(schema.challans.createdAt)).limit(5);

  return c.json({
    data: {
      customerCount,
      productCount,
      draftChallans,
      confirmedChallans,
      lowStock,
      recentChallans,
    },
  });
});
