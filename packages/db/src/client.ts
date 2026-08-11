import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL ?? "postgresql://erp:erp_password@localhost:5432/erp_crm";

// max: keep the pool modest for local/dev + small free-tier hosted Postgres instances
const queryClient = postgres(connectionString, { max: 10 });

export const db = drizzle(queryClient, { schema });
export * as schema from "./schema";
