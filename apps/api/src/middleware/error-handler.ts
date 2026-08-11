import type { Context } from "hono";
import { ApiError } from "../lib/errors";
import { ZodError } from "zod";

export function errorHandler(err: unknown, c: Context) {
  if (err instanceof ApiError) {
    return c.json(err.toJSON(), err.status as any);
  }
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) fields[issue.path.join(".")] = issue.message;
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request", fields } }, 400);
  }
  console.error("Unhandled error:", err);
  return c.json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, 500);
}
