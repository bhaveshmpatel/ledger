import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./client";
import { users, customers, customerNotes, products, stockMovements, challans, challanItems } from "./schema";

// Helper for generating dates in the past 90 days
function randomDatePast90Days() {
  const now = new Date();
  const past = new Date(now.getTime() - Math.random() * 90 * 24 * 60 * 60 * 1000);
  return past;
}

// Generate realistic sequences
function pad(num: number, size: number) {
  let s = num + "";
  while (s.length < size) s = "0" + s;
  return s;
}

async function seed() {
  console.log("Seeding database with past 3 months of data...");

  // 1. Users
  const passwordHash = await bcrypt.hash("Passw0rd!", 10);
  const [admin, sales, warehouse, accounts] = await db
    .insert(users)
    .values([
      { name: "Admin User", email: "admin@erp.test", passwordHash, role: "admin" },
      { name: "Sales User", email: "sales@erp.test", passwordHash, role: "sales" },
      { name: "Warehouse User", email: "warehouse@erp.test", passwordHash, role: "warehouse" },
      { name: "Accounts User", email: "accounts@erp.test", passwordHash, role: "accounts" },
    ])
    .returning();

  console.log("Created users...");

  // 2. Customers
  const customerTypes = ["retail", "wholesale", "distributor"];
  const customerStatuses = ["lead", "active", "inactive"];
  const cities = ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar"];
  
  const customerData = Array.from({ length: 50 }).map((_, i) => {
    const type = customerTypes[Math.floor(Math.random() * customerTypes.length)];
    const status = customerStatuses[Math.floor(Math.random() * customerStatuses.length)];
    const city = cities[Math.floor(Math.random() * cities.length)];
    const createdAt = randomDatePast90Days();
    return {
      name: `Customer ${i + 1}`,
      mobile: `98000${pad(i, 5)}`,
      email: `contact${i + 1}@example.com`,
      businessName: `Enterprise ${i + 1} ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      customerType: type,
      address: `Shop ${i + 1}, Main Road, ${city}`,
      status,
      followUpDate: status === "lead" ? new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null,
      createdAt,
      createdBy: sales.id,
    };
  });

  const seededCustomers = await db.insert(customers).values(customerData).returning();
  console.log(`Created ${seededCustomers.length} customers...`);

  // 3. Customer Notes
  const notesData = seededCustomers.flatMap(c => {
    const count = Math.floor(Math.random() * 4); // 0 to 3 notes per customer
    return Array.from({ length: count }).map((_, i) => ({
      customerId: c.id,
      note: `Follow up note ${i + 1} for ${c.name}. Discussed pricing and catalog.`,
      createdAt: randomDatePast90Days(),
      createdBy: sales.id,
    }));
  });
  if (notesData.length > 0) {
    await db.insert(customerNotes).values(notesData);
    console.log(`Created ${notesData.length} follow-up notes...`);
  }

  // 4. Products
  const categories = ["Hardware", "Plumbing", "Electrical", "Paints", "Tools", "Accessories"];
  const productData = Array.from({ length: 50 }).map((_, i) => {
    const category = categories[Math.floor(Math.random() * categories.length)];
    const price = (Math.floor(Math.random() * 500) + 10).toFixed(2);
    const stock = Math.floor(Math.random() * 1000) + 50;
    const minAlert = Math.floor(Math.random() * 100) + 10;
    return {
      name: `${category} Item ${i + 1}`,
      sku: `SKU-${1000 + i}`,
      category,
      unitPrice: price,
      currentStock: stock,
      minStockAlert: minAlert,
      location: `Rack ${String.fromCharCode(65 + Math.floor(Math.random() * 5))}-${Math.floor(Math.random() * 10)}`,
      createdAt: randomDatePast90Days(),
    };
  });

  const seededProducts = await db.insert(products).values(productData).returning();
  console.log(`Created ${seededProducts.length} products...`);

  // 5. Stock Movements
  const movementData = seededProducts.flatMap(p => {
    const count = Math.floor(Math.random() * 5) + 1; // 1 to 5 movements
    return Array.from({ length: count }).map(() => {
      const type = Math.random() > 0.3 ? "IN" : "OUT";
      const qty = Math.floor(Math.random() * 100) + 10;
      return {
        productId: p.id,
        quantityChanged: qty,
        movementType: type as "IN" | "OUT",
        reason: type === "IN" ? "Restock from supplier" : "Manual adjustment / Sale",
        createdAt: randomDatePast90Days(),
        createdBy: warehouse.id,
      };
    });
  });
  if (movementData.length > 0) {
    await db.insert(stockMovements).values(movementData);
    console.log(`Created ${movementData.length} stock movements...`);
  }

  // 6. Challans & Items
  const challansData = Array.from({ length: 100 }).map((_, i) => {
    const customer = seededCustomers[Math.floor(Math.random() * seededCustomers.length)];
    const status = Math.random() > 0.2 ? "confirmed" : (Math.random() > 0.5 ? "draft" : "cancelled");
    const createdAt = randomDatePast90Days();
    return {
      challanNumber: `CH-2026-${pad(i + 1, 4)}`,
      customerId: customer.id,
      status,
      totalQuantity: 0, // will calculate later
      createdAt,
      confirmedAt: status === "confirmed" ? new Date(createdAt.getTime() + 1000 * 60 * 60 * 24) : null,
      createdBy: sales.id,
    };
  });

  // Since we need to insert challans to get their IDs, and then insert items,
  // we'll insert them in batches or all at once, then generate items.
  const seededChallans = await db.insert(challans).values(challansData).returning();
  console.log(`Created ${seededChallans.length} challans...`);

  const allChallanItems = [];
  const challanUpdates = [];

  for (const ch of seededChallans) {
    const numItems = Math.floor(Math.random() * 5) + 1; // 1 to 5 items
    let totalQty = 0;
    
    // Pick unique products for this challan
    const shuffledProducts = [...seededProducts].sort(() => 0.5 - Math.random());
    const selectedProducts = shuffledProducts.slice(0, numItems);

    for (const p of selectedProducts) {
      const qty = Math.floor(Math.random() * 20) + 1;
      totalQty += qty;
      allChallanItems.push({
        challanId: ch.id,
        productId: p.id,
        productName: p.name,
        productSku: p.sku,
        unitPrice: p.unitPrice,
        quantity: qty,
      });
    }

    challanUpdates.push({ id: ch.id, totalQuantity: totalQty });
  }

  if (allChallanItems.length > 0) {
    // Insert all items
    await db.insert(challanItems).values(allChallanItems);
    
    // Update challans with total quantity
    // Using a simple loop for updates since Drizzle bulk update with different values is tricky
    for (const update of challanUpdates) {
      await db.update(challans)
        .set({ totalQuantity: update.totalQuantity })
        .where(eq(challans.id, update.id));
    }
    console.log(`Created ${allChallanItems.length} challan items...`);
  }

  console.log("Seed complete. Test logins (password: Passw0rd!):");
  console.log("  admin@erp.test / sales@erp.test / warehouse@erp.test / accounts@erp.test");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
