import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (check .env.local)");
  process.exit(1);
}

const sqlPath = resolve("drizzle/0000_init.sql");
const body = readFileSync(sqlPath, "utf8");
const sql = postgres(url, { prepare: false, max: 1 });

try {
  await sql.unsafe(body);
  console.log("Applied", sqlPath);
} finally {
  await sql.end({ timeout: 5 });
}
