import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin allowlist.
 * - Production: only emails in VIBEWORK_ADMIN_EMAILS (comma-separated).
 * - Dev/preview: VIBEWORK_TESTER=1 also grants admin to any signed-in user
 *   (never in production / Vercel production).
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const list = adminEmailList();
  if (list.includes(normalized)) return true;
  if (testerBypassEnabled()) return true;
  return false;
}

export function adminEmailList(): string[] {
  return (process.env.VIBEWORK_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** True only outside production so a forgotten TESTER=1 cannot open admin in prod. */
export function testerBypassEnabled(): boolean {
  if (process.env.VIBEWORK_TESTER !== "1") return false;
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.VERCEL_ENV === "production") return false;
  return true;
}

export type AdminUser = {
  id: string;
  email: string;
};

/** Server gate for /admin/* — unknown visitors get a generic 404 (no “admin exists” leak). */
export async function requireAdmin(): Promise<AdminUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?signin=1");
  if (!isAdminEmail(user.email)) notFound();
  return { id: user.id, email: user.email || "" };
}
