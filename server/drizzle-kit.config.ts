import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// 환경변수 로드
config({ path: "./.env" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
