import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env } from "./lib/env";
import { errorHandler } from "./middleware/error-handler";
import { authRoutes } from "./modules/auth/routes";
import { customerRoutes } from "./modules/customers/routes";
import { productRoutes } from "./modules/products/routes";
import { challanRoutes } from "./modules/challans/routes";
import { dashboardRoutes } from "./modules/dashboard/routes";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);

app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

const api = new Hono();
api.route("/auth", authRoutes);
api.route("/customers", customerRoutes);
api.route("/products", productRoutes);
api.route("/challans", challanRoutes);
api.route("/dashboard", dashboardRoutes);

app.route("/api/v1", api);

app.onError(errorHandler);
app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Route not found" } }, 404));

console.log(`API listening on port ${env.PORT}`);

export default {
  port: env.PORT,
  fetch: app.fetch,
};
