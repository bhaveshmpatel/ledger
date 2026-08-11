import { z } from "zod";

export const CHALLAN_STATUSES = ["draft", "confirmed", "cancelled"] as const;

export const challanItemInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
});

export const createChallanSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(challanItemInputSchema).min(1, "Add at least one product"),
});
export type CreateChallanInput = z.infer<typeof createChallanSchema>;

export const updateChallanSchema = z.object({
  customerId: z.string().uuid().optional(),
  items: z.array(challanItemInputSchema).min(1).optional(),
});
export type UpdateChallanInput = z.infer<typeof updateChallanSchema>;
