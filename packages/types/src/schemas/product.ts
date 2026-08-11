import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(2, "Name is required"),
  sku: z.string().min(1, "SKU is required"),
  category: z.string().min(1, "Category is required"),
  unitPrice: z.coerce.number().nonnegative(),
  currentStock: z.coerce.number().int().nonnegative().default(0),
  minStockAlert: z.coerce.number().int().nonnegative().default(0),
  location: z.string().optional().or(z.literal("")),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const stockMovementTypes = ["IN", "OUT"] as const;

export const createStockMovementSchema = z.object({
  quantityChanged: z.coerce.number().int().positive(),
  movementType: z.enum(stockMovementTypes),
  reason: z.string().min(1, "Reason is required"),
});
export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;
