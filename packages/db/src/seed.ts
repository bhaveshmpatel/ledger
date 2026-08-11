import bcrypt from "bcryptjs";
import { db } from "./client";
import { users, customers, products, challans, challanItems } from "./schema";

async function seed() {
  console.log("Seeding database...");

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

  const seededCustomers = await db
    .insert(customers)
    .values([
      { name: "Ramesh Traders", mobile: "9800000001", businessName: "Ramesh Traders", customerType: "wholesale", address: "APMC Market, Ahmedabad", status: "active", createdBy: sales.id },
      { name: "Sunrise Distributors", mobile: "9800000002", businessName: "Sunrise Distributors", customerType: "distributor", address: "GIDC Vatva, Ahmedabad", status: "active", createdBy: sales.id },
      { name: "Patel General Store", mobile: "9800000003", businessName: "Patel General Store", customerType: "retail", address: "Maninagar, Ahmedabad", status: "lead", followUpDate: "2026-08-20", createdBy: sales.id },
      { name: "Om Enterprises", mobile: "9800000004", businessName: "Om Enterprises", customerType: "wholesale", address: "Naroda, Ahmedabad", status: "inactive", createdBy: sales.id },
      { name: "Krishna Wholesale", mobile: "9800000005", businessName: "Krishna Wholesale", customerType: "wholesale", address: "Bapunagar, Ahmedabad", status: "active", createdBy: sales.id },
    ])
    .returning();

  const seededProducts = await db
    .insert(products)
    .values([
      { name: "Steel Pipe 1 inch", sku: "SKU-1001", category: "Hardware", unitPrice: "180.00", currentStock: 500, minStockAlert: 50, location: "Rack A1" },
      { name: "Steel Pipe 2 inch", sku: "SKU-1002", category: "Hardware", unitPrice: "320.00", currentStock: 20, minStockAlert: 30, location: "Rack A2" },
      { name: "PVC Pipe 1 inch", sku: "SKU-1003", category: "Plumbing", unitPrice: "95.00", currentStock: 800, minStockAlert: 100, location: "Rack B1" },
      { name: "Cement Bag 50kg", sku: "SKU-1004", category: "Construction", unitPrice: "410.00", currentStock: 200, minStockAlert: 40, location: "Yard 1" },
      { name: "Paint - White 20L", sku: "SKU-1005", category: "Paints", unitPrice: "2600.00", currentStock: 15, minStockAlert: 10, location: "Rack C1" },
      { name: "Wire 1.5mm (coil)", sku: "SKU-1006", category: "Electrical", unitPrice: "1450.00", currentStock: 60, minStockAlert: 15, location: "Rack D1" },
      { name: "MCB Switch 16A", sku: "SKU-1007", category: "Electrical", unitPrice: "220.00", currentStock: 8, minStockAlert: 20, location: "Rack D2" },
      { name: "Ceramic Tile 2x2", sku: "SKU-1008", category: "Tiles", unitPrice: "55.00", currentStock: 3000, minStockAlert: 500, location: "Yard 2" },
      { name: "Adhesive 20kg", sku: "SKU-1009", category: "Construction", unitPrice: "380.00", currentStock: 45, minStockAlert: 25, location: "Rack B2" },
      { name: "Nut Bolt Set (100pc)", sku: "SKU-1010", category: "Hardware", unitPrice: "150.00", currentStock: 120, minStockAlert: 30, location: "Rack A3" },
    ])
    .returning();

  const [draftChallan] = await db
    .insert(challans)
    .values({ challanNumber: "CH-2026-0001", customerId: seededCustomers[0].id, status: "draft", totalQuantity: 60, createdBy: sales.id })
    .returning();

  await db.insert(challanItems).values([
    { challanId: draftChallan.id, productId: seededProducts[0].id, productName: seededProducts[0].name, productSku: seededProducts[0].sku, unitPrice: seededProducts[0].unitPrice, quantity: 40 },
    { challanId: draftChallan.id, productId: seededProducts[2].id, productName: seededProducts[2].name, productSku: seededProducts[2].sku, unitPrice: seededProducts[2].unitPrice, quantity: 20 },
  ]);

  const [confirmedChallan] = await db
    .insert(challans)
    .values({ challanNumber: "CH-2026-0002", customerId: seededCustomers[1].id, status: "confirmed", totalQuantity: 10, createdBy: sales.id, confirmedAt: new Date() })
    .returning();

  await db.insert(challanItems).values([
    { challanId: confirmedChallan.id, productId: seededProducts[3].id, productName: seededProducts[3].name, productSku: seededProducts[3].sku, unitPrice: seededProducts[3].unitPrice, quantity: 10 },
  ]);

  console.log("Seed complete. Test logins (password: Passw0rd!):");
  console.log("  admin@erp.test / sales@erp.test / warehouse@erp.test / accounts@erp.test");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
