import { Suspense } from "react";
import { notFound } from "next/navigation";
import { TryShell } from "@/components/try/TryShell";
import { BuildingScreen } from "@/components/try/BuildingScreen";
import { HeaderAccount } from "@/components/try/HeaderAccount";
import { getHeaderSession } from "@/lib/auth/header-session";
import { getRunForUser } from "@/lib/db/runs";
import { createClient } from "@/lib/supabase/server";

export default function RunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <TryShell
      roleBar="Building your work-day"
      headerRight={
        <Suspense fallback={<span className="clock">…</span>}>
          <HeaderSlot />
        </Suspense>
      }
    >
      <Suspense
        fallback={
          <div className="pane">
            <h1>Building your work-day</h1>
            <p className="sub">Loading…</p>
          </div>
        }
      >
        <RunBody params={params} />
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

async function RunBody({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const run = await getRunForUser(id, user.id);
  if (!run) notFound();

  const preview =
    run.inputText.length > 200
      ? run.inputText.slice(0, 200) + "…"
      : run.inputText;

  return <BuildingScreen runId={id} inputPreview={preview} />;
}
