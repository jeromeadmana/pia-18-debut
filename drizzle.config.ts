import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// `neon link` writes credentials to .env.local, not .env.
config({ path: ".env.local" });

// Migrations run DDL, so prefer the direct (unpooled) connection. The pooled URL
// works too, but PgBouncer in transaction mode can surprise you on some DDL.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL_UNPOOLED / DATABASE_URL missing. Run `neon link` to populate .env.local.",
  );
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  // Write snake_case columns while keeping camelCase in TypeScript.
  casing: "snake_case",
  strict: true,
  verbose: true,
});
