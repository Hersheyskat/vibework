import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

/** Service-role client (bypasses RLS). Prefer when DATABASE_URL is unset. */
export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "Set DATABASE_URL or SUPABASE_SERVICE_ROLE_KEY for server writes",
    );
  }
  if (!admin) {
    admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

export function hasDbAccess(): boolean {
  return Boolean(
    process.env.DATABASE_URL?.trim() ||
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}
