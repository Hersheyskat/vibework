import { Suspense } from "react";
import { TryShell } from "@/components/try/TryShell";
import { SetupScreen } from "@/components/try/SetupScreen";
import { HeaderAccount } from "@/components/try/HeaderAccount";
import { getHeaderSession } from "@/lib/auth/header-session";

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
  const s = await getHeaderSession();
  return (
    <HeaderAccount
      signedIn={s.signedIn}
      label={s.label}
      isAdmin={s.isAdmin}
    />
  );
}

async function HomeBody() {
  const s = await getHeaderSession();
  return <SetupScreen signedIn={s.signedIn} learnerLabel={s.label} />;
}
