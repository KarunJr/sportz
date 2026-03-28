import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

if (!process.env.DEV_DATABASE_URL) {
  throw new Error("DATABASE URL is not defined");
}

const pool = new Pool({
  connectionString: process.env.DEV_DATABASE_URL,
});

export const db = drizzle(pool);
