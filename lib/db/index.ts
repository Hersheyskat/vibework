import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { hasDbAccess } from "./admin";

let client: ReturnType<typeof postgres> | null = null;

/** Server-only Postgres via DATABASE_URL. Prefer hasDbAccess() + runs helpers. */
export function getDb() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set (or use SUPABASE_SERVICE_ROLE_KEY with admin helpers)",
    );
  }
  if (!client) {
    client = postgres(url, { prepare: false, max: 10 });
  }
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof getDb>;

export { hasDbAccess };
