import { z } from "zod";

export const CUSTOMER_TYPES = ["retail", "wholesale", "distributor"] as const;
export const CUSTOMER_STATUSES = ["lead", "active", "inactive"] as const;

export const createCustomerSchema = z.object({
  name: z.string().min(2, "Name is required"),
  mobile: z.string().min(7, "Enter a valid mobile number"),
  email: z.string().email().optional().or(z.literal("")),
  businessName: z.string().min(1, "Business name is required"),
  gstNumber: z.string().optional().or(z.literal("")),
  customerType: z.enum(CUSTOMER_TYPES),
  address: z.string().min(1, "Address is required"),
  status: z.enum(CUSTOMER_STATUSES).default("lead"),
  followUpDate: z.string().date().optional().or(z.literal("")),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema.partial();
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const createCustomerNoteSchema = z.object({
  note: z.string().min(1, "Note cannot be empty"),
});
export type CreateCustomerNoteInput = z.infer<typeof createCustomerNoteSchema>;
