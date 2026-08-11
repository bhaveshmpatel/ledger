import { db } from "./src/client";
import { sql } from "drizzle-orm";
async function reset() {
  await db.execute(sql`DROP SCHEMA public CASCADE;`);
  await db.execute(sql`CREATE SCHEMA public;`);
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE;`);
  process.exit(0);
}
reset();
