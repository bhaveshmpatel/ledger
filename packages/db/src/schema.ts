import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  numeric,
  timestamp,
  date,
  boolean,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const roleEnum = pgEnum("role", ["admin", "sales", "warehouse", "accounts"]);
export const customerTypeEnum = pgEnum("customer_type", ["retail", "wholesale", "distributor"]);
export const customerStatusEnum = pgEnum("customer_status", ["lead", "active", "inactive"]);
export const movementTypeEnum = pgEnum("movement_type", ["IN", "OUT"]);
export const challanStatusEnum = pgEnum("challan_status", ["draft", "confirmed", "cancelled"]);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("sales"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  emailIdx: uniqueIndex("users_email_idx").on(t.email),
}));

// ---------------------------------------------------------------------------
// Customers (CRM)
// ---------------------------------------------------------------------------
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  mobile: varchar("mobile", { length: 32 }).notNull(),
  email: varchar("email", { length: 255 }),
  businessName: varchar("business_name", { length: 255 }).notNull(),
  gstNumber: varchar("gst_number", { length: 32 }),
  customerType: customerTypeEnum("customer_type").notNull().default("retail"),
  address: text("address").notNull(),
  status: customerStatusEnum("status").notNull().default("lead"),
  followUpDate: date("follow_up_date"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customerNotes = pgTable("customer_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  note: text("note").notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Products / Inventory
// ---------------------------------------------------------------------------
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 64 }).notNull(),
  category: varchar("category", { length: 128 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  currentStock: integer("current_stock").notNull().default(0),
  minStockAlert: integer("min_stock_alert").notNull().default(0),
  location: varchar("location", { length: 255 }),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  skuIdx: uniqueIndex("products_sku_idx").on(t.sku),
}));

export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  quantityChanged: integer("quantity_changed").notNull(),
  movementType: movementTypeEnum("movement_type").notNull(),
  reason: text("reason").notNull(),
  referenceType: varchar("reference_type", { length: 32 }),
  referenceId: uuid("reference_id"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Sales Challans
// ---------------------------------------------------------------------------
export const challans = pgTable("challans", {
  id: uuid("id").primaryKey().defaultRandom(),
  challanNumber: varchar("challan_number", { length: 32 }).notNull(),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "restrict" }),
  status: challanStatusEnum("status").notNull().default("draft"),
  totalQuantity: integer("total_quantity").notNull().default(0),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
}, (t) => ({
  challanNumberIdx: uniqueIndex("challans_number_idx").on(t.challanNumber),
}));

export const challanItems = pgTable("challan_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  challanId: uuid("challan_id").notNull().references(() => challans.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "restrict" }),
  // Snapshot fields — preserved even if the product changes later
  productName: varchar("product_name", { length: 255 }).notNull(),
  productSku: varchar("product_sku", { length: 64 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

// users → customers (via customers.createdBy)
// users → customerNotes (via customerNotes.createdBy)
// users → stockMovements (via stockMovements.createdBy)
// users → challans (via challans.createdBy)
// Each many() is named to match the one() on the child side.
export const usersRelations = relations(users, ({ many }) => ({
  createdCustomers:      many(customers,      { relationName: "customerCreatedBy" }),
  createdCustomerNotes:  many(customerNotes,  { relationName: "customerNoteCreatedBy" }),
  createdStockMovements: many(stockMovements, { relationName: "stockMovementCreatedBy" }),
  createdChallans:       many(challans,       { relationName: "challanCreatedBy" }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  createdByUser: one(users, {
    relationName: "customerCreatedBy",
    fields: [customers.createdBy],
    references: [users.id],
  }),
  notes:    many(customerNotes),
  challans: many(challans),
}));

export const customerNotesRelations = relations(customerNotes, ({ one }) => ({
  customer: one(customers, {
    fields: [customerNotes.customerId],
    references: [customers.id],
  }),
  createdByUser: one(users, {
    relationName: "customerNoteCreatedBy",
    fields: [customerNotes.createdBy],
    references: [users.id],
  }),
}));

export const productsRelations = relations(products, ({ many }) => ({
  movements:    many(stockMovements),
  challanItems: many(challanItems),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
  createdByUser: one(users, {
    relationName: "stockMovementCreatedBy",
    fields: [stockMovements.createdBy],
    references: [users.id],
  }),
}));

export const challansRelations = relations(challans, ({ one, many }) => ({
  customer: one(customers, {
    fields: [challans.customerId],
    references: [customers.id],
  }),
  createdByUser: one(users, {
    relationName: "challanCreatedBy",
    fields: [challans.createdBy],
    references: [users.id],
  }),
  items: many(challanItems),
}));

export const challanItemsRelations = relations(challanItems, ({ one }) => ({
  challan: one(challans, {
    fields: [challanItems.challanId],
    references: [challans.id],
  }),
  product: one(products, {
    fields: [challanItems.productId],
    references: [products.id],
  }),
}));
