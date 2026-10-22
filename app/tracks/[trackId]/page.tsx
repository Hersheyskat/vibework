import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TrackStartGate } from "@/components/auth/TrackStartGate";
import { SiteChrome } from "@/components/shell/SiteChrome";
import { getCatalogTrack } from "@/lib/scenarios/catalog";
import { createClient } from "@/lib/supabase/server";

export default function TrackPage({
  params,
}: {
  params: Promise<{ trackId: string }>;
}) {
  return (
    <SiteChrome>
      <main className="mx-auto w-full max-w-5xl px-6 pb-20 pt-10">
        <Suspense
          fallback={
            <div className="mt-10 text-sm text-white/45">Loading scenario…</div>
          }
        >
          <TrackBody params={params} />
        </Suspense>
      </main>
    </SiteChrome>
  );
}

async function TrackBody({
  params,
}: {
  params: Promise<{ trackId: string }>;
}) {
  const { trackId } = await params;
  const track = getCatalogTrack(trackId);
  if (!track) notFound();

  return (
    <div className="max-w-xl">
      <Link
        href="/"
        className="text-[13px] text-white/40 transition hover:text-white/70"
      >
        ← All scenarios
      </Link>

      <div className="mt-6 vw-animate-in">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--vw-accent)]">
          {track.role}
        </p>
        <h1 className="mt-2 text-[2.1rem] font-semibold leading-[1.1] tracking-tight">
          {track.companyName}
        </h1>
        <p className="mt-1 text-[15px] text-white/50">{track.title}</p>
        <p className="mt-4 text-[14px] leading-relaxed text-white/60">
          {track.oneLiner}
        </p>
        <p className="mt-3 text-[12px] text-white/35">
          {track.dayCount} work days · Slack-style workspace
        </p>
      </div>

      <div className="mt-8">
        <Suspense
          fallback={
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-white/45">
              Checking session…
            </div>
          }
        >
          <TrackAuthGate trackId={track.id} />
        </Suspense>
      </div>
    </div>
  );
}

async function TrackAuthGate({ trackId }: { trackId: string }) {
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

  return (
    <TrackStartGate
      trackId={trackId}
      learnerName={learnerName}
      email={email}
    />
  );
}
