import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const queryClient = postgres(process.env.DATABASE_URL, {
  ssl: "require",
  max: 10,
});

// Passing schema enables db.query.* relational API
export const db = drizzle(queryClient, { schema });

export type Db = typeof db;
