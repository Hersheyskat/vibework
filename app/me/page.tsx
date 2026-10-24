import { Suspense } from "react";
import { redirect } from "next/navigation";
import { TryShell } from "@/components/try/TryShell";
import { HeaderAccount } from "@/components/try/HeaderAccount";
import { MyDaysScreen } from "@/components/try/MyDaysScreen";
import { getHeaderSession } from "@/lib/auth/header-session";
import { createClient } from "@/lib/supabase/server";

export default function MyDaysPage() {
  return (
    <TryShell
      roleBar="My practice days"
      headerRight={
        <Suspense fallback={<span className="clock">…</span>}>
          <HeaderSlot />
        </Suspense>
      }
    >
      <Suspense
        fallback={
          <div className="pane">
            <h1>My days</h1>
            <p className="sub">Loading…</p>
          </div>
        }
      >
        <MyDaysBody />
      </Suspense>
    </TryShell>
  );
}

async function HeaderSlot() {
  const s = await getHeaderSession();
  return (
    <HeaderAccount
      signedIn={s.signedIn}
      label={s.label}
      isAdmin={s.isAdmin}
    />
  );
}

async function MyDaysBody() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/?signin=1");
  return <MyDaysScreen />;
}
