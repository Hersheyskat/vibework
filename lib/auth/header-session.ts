import { isAdminEmail } from "@/lib/admin/access";
import { createClient } from "@/lib/supabase/server";

export type HeaderSession = {
  signedIn: boolean;
  label: string | null;
  isAdmin: boolean;
};

export async function getHeaderSession(): Promise<HeaderSession> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { signedIn: false, label: null, isAdmin: false };
  }
  const meta = user.user_metadata ?? {};
  const learnerName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    null;
  return {
    signedIn: true,
    label: learnerName || user.email || null,
    isAdmin: isAdminEmail(user.email),
  };
}
