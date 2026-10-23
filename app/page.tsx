import { Suspense } from "react";
import { TryShell } from "@/components/try/TryShell";
import { SetupScreen } from "@/components/try/SetupScreen";
import { HeaderAccount } from "@/components/try/HeaderAccount";
import { createClient } from "@/lib/supabase/server";

export default function HomePage() {
  return (
    <TryShell
      headerRight={
        <Suspense fallback={<span className="clock">…</span>}>
          <HeaderAccountSlot />
        </Suspense>
      }
    >
      <Suspense
        fallback={
          <div className="pane">
            <div className="hero">
              <div className="kick">VibeWork Try · practice mode</div>
              <h1>Vibe check any job</h1>
              <p className="sub">Loading…</p>
            </div>
          </div>
        }
      >
        <HomeBody />
      </Suspense>
    </TryShell>
  );
}

async function HeaderAccountSlot() {
  const { signedIn, label } = await getSessionLabel();
  return <HeaderAccount signedIn={signedIn} label={label} />;
}

async function HomeBody() {
  const { signedIn, label } = await getSessionLabel();
  return <SetupScreen signedIn={signedIn} learnerLabel={label} />;
}

async function getSessionLabel() {
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
  return {
    signedIn: Boolean(user),
    label: learnerName || email,
  };
}
