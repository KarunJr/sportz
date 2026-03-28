import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!process.env.DEV_DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in the .env file");
}

const getBranchURL = () => {
  const env = process.env.NODE_ENV;
  if (env === "development") return process.env.DEV_DATABASE_URL;
  if (env === "production") return process.env.PROD_DATABASE_URL;

  return process.env.DEV_DATABASE_URL;
};
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: getBranchURL(),
  },
});
