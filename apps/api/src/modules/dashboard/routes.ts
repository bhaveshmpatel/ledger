import { Hono } from "hono";
import { desc, eq, and, sql, count } from "drizzle-orm";
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

  const salesHistory = await db
    .select({
      date: sql<string>`TO_CHAR(DATE(${schema.challans.createdAt}), 'Mon DD')`,
      units: sql<number>`SUM(${schema.challans.totalQuantity})::int`,
    })
    .from(schema.challans)
    .where(
      and(
        eq(schema.challans.status, "confirmed"),
        sql`${schema.challans.createdAt} >= NOW() - INTERVAL '30 days'`
      )
    )
    .groupBy(sql`DATE(${schema.challans.createdAt})`)
    .orderBy(sql`DATE(${schema.challans.createdAt}) ASC`);

  return c.json({
    data: {
      customerCount,
      productCount,
      draftChallans,
      confirmedChallans,
      lowStock,
      recentChallans,
      salesHistory,
    },
  });
});
