/**
 * DEV ONLY — drops and recreates the public schema, wiping all tables.
 * Run this when you need a clean slate before running db:migrate.
 *
 * Usage:  bun run db:reset
 */
import "dotenv/config";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const sql = postgres(url, { ssl: "require", max: 1 });

async function reset() {
  console.log("⚠️  Dropping public schema (all tables)…");
  await sql.unsafe(`
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO public;
  `);
  console.log("✓ Schema reset. Run db:migrate to recreate tables.");
  await sql.end();
}

reset().catch((err) => {
  console.error(err);
  process.exit(1);
});
