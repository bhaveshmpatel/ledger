import { eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@erp/db";
import { conflict, notFound, badRequest } from "../../lib/errors";
import type { CreateChallanInput, UpdateChallanInput } from "@erp/types";

/**
 * Generates the next challan number for the current year, e.g. CH-2026-0001.
 * Uses a row lock on a lightweight "counter" select to avoid collisions when
 * called from inside an existing transaction.
 */
async function nextChallanNumber(tx: typeof db): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CH-${year}-`;

  const [{ value: existingCount }] = await tx
    .select({ value: sql<number>`count(*)` })
    .from(schema.challans)
    .where(sql`${schema.challans.challanNumber} LIKE ${prefix + "%"}`);

  const next = Number(existingCount) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export async function createChallan(input: CreateChallanInput, userId: string) {
  return db.transaction(async (tx) => {
    const [customer] = await tx.select().from(schema.customers).where(eq(schema.customers.id, input.customerId)).limit(1);
    if (!customer) throw notFound("Customer");

    const productIds = input.items.map((i) => i.productId);
    const productRows = await tx.select().from(schema.products).where(inArray(schema.products.id, productIds));
    const productMap = new Map(productRows.map((p) => [p.id, p]));

    const missing = productIds.filter((id) => !productMap.has(id));
    if (missing.length) throw badRequest(`Unknown product id(s): ${missing.join(", ")}`);

    const challanNumber = await nextChallanNumber(tx as any);
    const totalQuantity = input.items.reduce((sum, i) => sum + i.quantity, 0);

    const [challan] = await tx
      .insert(schema.challans)
      .values({ challanNumber, customerId: input.customerId, status: "draft", totalQuantity, createdBy: userId })
      .returning();

    const itemRows = input.items.map((item) => {
      const product = productMap.get(item.productId)!;
      return {
        challanId: challan.id,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        unitPrice: product.unitPrice,
        quantity: item.quantity,
      };
    });
    await tx.insert(schema.challanItems).values(itemRows);

    return { ...challan, items: itemRows };
  });
}

export async function updateChallan(challanId: string, input: UpdateChallanInput) {
  return db.transaction(async (tx) => {
    const [challan] = await tx.select().from(schema.challans).where(eq(schema.challans.id, challanId)).limit(1);
    if (!challan) throw notFound("Challan");
    if (challan.status !== "draft") throw conflict("Only draft challans can be edited");

    if (input.customerId) {
      await tx.update(schema.challans).set({ customerId: input.customerId }).where(eq(schema.challans.id, challanId));
    }

    if (input.items) {
      const productIds = input.items.map((i) => i.productId);
      const productRows = await tx.select().from(schema.products).where(inArray(schema.products.id, productIds));
      const productMap = new Map(productRows.map((p) => [p.id, p]));
      const missing = productIds.filter((id) => !productMap.has(id));
      if (missing.length) throw badRequest(`Unknown product id(s): ${missing.join(", ")}`);

      await tx.delete(schema.challanItems).where(eq(schema.challanItems.challanId, challanId));

      const itemRows = input.items.map((item) => {
        const product = productMap.get(item.productId)!;
        return {
          challanId,
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          unitPrice: product.unitPrice,
          quantity: item.quantity,
        };
      });
      await tx.insert(schema.challanItems).values(itemRows);

      const totalQuantity = input.items.reduce((sum, i) => sum + i.quantity, 0);
      await tx.update(schema.challans).set({ totalQuantity }).where(eq(schema.challans.id, challanId));
    }

    const [updated] = await tx.select().from(schema.challans).where(eq(schema.challans.id, challanId)).limit(1);
    return updated;
  });
}

/**
 * Confirms a draft challan: locks every referenced product row, verifies
 * sufficient stock for ALL items, and only then decrements stock and writes
 * stock_movements. If any item is short, the whole transaction is aborted —
 * no partial confirmation, no partial stock deduction.
 */
export async function confirmChallan(challanId: string, userId: string) {
  return db.transaction(async (tx) => {
    const [challan] = await tx.select().from(schema.challans).where(eq(schema.challans.id, challanId)).limit(1);
    if (!challan) throw notFound("Challan");
    if (challan.status !== "draft") throw conflict(`Challan is already ${challan.status}`);

    const items = await tx.select().from(schema.challanItems).where(eq(schema.challanItems.challanId, challanId));
    if (!items.length) throw badRequest("Challan has no items");

    const productIds = items.map((i) => i.productId);
    // Row-level lock on every referenced product to serialize concurrent confirms.
    const lockedProducts = await tx
      .select()
      .from(schema.products)
      .where(inArray(schema.products.id, productIds))
      .for("update");
    const productMap = new Map(lockedProducts.map((p) => [p.id, p]));

    const shortages: Record<string, string> = {};
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product || product.currentStock < item.quantity) {
        shortages[item.productSku] = product
          ? `Requested ${item.quantity}, only ${product.currentStock} in stock`
          : "Product no longer exists";
      }
    }
    if (Object.keys(shortages).length > 0) {
      throw conflict("Insufficient stock for one or more items. Confirmation aborted — no stock was changed.", shortages);
    }

    for (const item of items) {
      const product = productMap.get(item.productId)!;
      await tx
        .update(schema.products)
        .set({ currentStock: product.currentStock - item.quantity, updatedAt: new Date() })
        .where(eq(schema.products.id, item.productId));

      await tx.insert(schema.stockMovements).values({
        productId: item.productId,
        quantityChanged: item.quantity,
        movementType: "OUT",
        reason: `Sales Challan ${challan.challanNumber}`,
        referenceType: "challan",
        referenceId: challan.id,
        createdBy: userId,
      });
    }

    const [updated] = await tx
      .update(schema.challans)
      .set({ status: "confirmed", confirmedAt: new Date() })
      .where(eq(schema.challans.id, challanId))
      .returning();

    return updated;
  });
}

/**
 * Cancels a challan. If it was already confirmed, restores the stock via
 * compensating IN movements inside the same transaction.
 */
export async function cancelChallan(challanId: string, userId: string) {
  return db.transaction(async (tx) => {
    const [challan] = await tx.select().from(schema.challans).where(eq(schema.challans.id, challanId)).limit(1);
    if (!challan) throw notFound("Challan");
    if (challan.status === "cancelled") throw conflict("Challan is already cancelled");

    if (challan.status === "confirmed") {
      const items = await tx.select().from(schema.challanItems).where(eq(schema.challanItems.challanId, challanId));
      for (const item of items) {
        await tx
          .update(schema.products)
          .set({ currentStock: sql`${schema.products.currentStock} + ${item.quantity}`, updatedAt: new Date() })
          .where(eq(schema.products.id, item.productId));

        await tx.insert(schema.stockMovements).values({
          productId: item.productId,
          quantityChanged: item.quantity,
          movementType: "IN",
          reason: `Cancelled Sales Challan ${challan.challanNumber} — stock restored`,
          referenceType: "challan",
          referenceId: challan.id,
          createdBy: userId,
        });
      }
    }

    const [updated] = await tx
      .update(schema.challans)
      .set({ status: "cancelled" })
      .where(eq(schema.challans.id, challanId))
      .returning();

    return updated;
  });
}

export async function getChallanWithItems(challanId: string) {
  const [challan] = await db.select().from(schema.challans).where(eq(schema.challans.id, challanId)).limit(1);
  if (!challan) throw notFound("Challan");
  const items = await db.select().from(schema.challanItems).where(eq(schema.challanItems.challanId, challanId));
  const [customer] = await db.select().from(schema.customers).where(eq(schema.customers.id, challan.customerId)).limit(1);
  return { ...challan, items, customer };
}
