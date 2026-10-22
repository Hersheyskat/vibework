import { Suspense } from "react";
import { HomeGate } from "@/components/auth/HomeGate";
import { createClient } from "@/lib/supabase/server";

export default function HomePage() {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[var(--vw-bg)] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 480px at 15% -10%, rgba(15,157,138,0.35), transparent 55%), radial-gradient(700px 420px at 90% 10%, rgba(59,130,246,0.18), transparent 50%), linear-gradient(180deg, #0f1218 0%, #151a22 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse at center, black 20%, transparent 75%)",
        }}
      />

      <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col justify-center px-6 py-16">
        <div className="mb-8 flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-[12px] text-base font-bold"
            style={{
              background: "linear-gradient(145deg, #0f9d8a 0%, #0b6e8a 100%)",
            }}
          >
            V
          </div>
          <div>
            <div className="text-sm font-medium tracking-wide text-white/70">
              VibeWork
            </div>
            <div className="text-xs text-white/45">Workplace practice</div>
          </div>
        </div>

        <h1 className="text-[2.35rem] font-semibold leading-[1.1] tracking-tight">
          Product Manager
          <span className="block text-white/55">at Zippy Café</span>
        </h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/60">
          Step into a Slack-style workspace. Chat with your team, pull data,
          handle the twist, and ship your first read — Day 1 starts now.
        </p>

        <Suspense
          fallback={
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-white/45">
              Checking session…
            </div>
          }
        >
          <HomeAuthGate />
        </Suspense>
      </main>
    </div>
  );
}

async function HomeAuthGate() {
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
    <HomeGate
      learnerName={learnerName}
      email={email}
      avatarUrl={avatarUrl}
    />
  );
}
