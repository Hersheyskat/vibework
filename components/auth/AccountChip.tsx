import { createClient } from "@/lib/supabase/server";
import { AccountChipClient } from "@/components/auth/AccountChipClient";

export async function AccountChip() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const meta = user?.user_metadata ?? {};
  const learnerName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    null;
  const email = user?.email ?? null;
  const avatarUrl =
    (typeof meta.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta.picture === "string" && meta.picture) ||
    null;

  return (
    <AccountChipClient
      learnerName={learnerName}
      email={email}
      avatarUrl={avatarUrl}
    />
  );
}
