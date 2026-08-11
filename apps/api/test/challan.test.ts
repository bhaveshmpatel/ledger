import { describe, expect, test } from "bun:test";

/**
 * These are integration tests for the challan confirm/cancel stock logic in
 * src/modules/challans/service.ts. They require a running Postgres instance
 * (see root docker-compose.yml) with DATABASE_URL pointed at a disposable
 * test database, and the schema migrated + seeded before running.
 *
 * Run: bun test  (after `bun run db:migrate && bun run db:seed` against a
 * test DB — wire a separate TEST_DATABASE_URL in CI, see .github/workflows/ci.yml)
 */

describe("challan stock rules", () => {
  test.todo("confirming a challan with sufficient stock decrements product.currentStock and writes an OUT stock_movement per item");
  test.todo("confirming a challan with insufficient stock on any single item returns 409 and leaves ALL product stock unchanged (no partial confirmation)");
  test.todo("two concurrent confirm requests racing for the last units of stock: exactly one succeeds, the other receives a 409 conflict");
  test.todo("cancelling a confirmed challan restores stock via compensating IN stock_movements and does not double-restore on repeated cancel calls");
  test.todo("cancelling a draft challan (never confirmed) does not touch stock at all");
  test.todo("challan numbers are unique and sequential per calendar year (CH-2026-0001, CH-2026-0002, ...)");
  test.todo("draft challans can be edited (items replaced); confirmed/cancelled challans reject PATCH with 409");
});
