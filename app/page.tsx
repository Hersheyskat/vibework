import { SiteChrome } from "@/components/shell/SiteChrome";
import { ScenarioCard } from "@/components/home/ScenarioCard";
import { getCatalogTracks } from "@/lib/scenarios/catalog";

export default function HomePage() {
  const tracks = getCatalogTracks();

  return (
    <SiteChrome>
      <main className="mx-auto max-w-5xl px-6 pb-20 pt-12 md:pt-16">
        <section className="max-w-2xl vw-animate-in">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/40">
            VibeWork
          </p>
          <h1 className="mt-3 text-[2.5rem] font-semibold leading-[1.08] tracking-tight md:text-[3rem]">
            Practice the job
            <span className="block text-white/50">before you get it</span>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/55">
            Pick a role inside a fictional company. Work through real days —
            chats, data, decisions — in a Slack-style workspace.
          </p>
        </section>

        <section className="mt-14">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Scenarios</h2>
              <p className="mt-1 text-[13px] text-white/40">
                Roles and companies you can step into
              </p>
            </div>
            <span className="text-[12px] text-white/30">
              {tracks.length} available
            </span>
          </div>

          {tracks.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/15 px-5 py-10 text-center text-sm text-white/40">
              No scenarios yet. Add a folder under{" "}
              <code className="text-white/60">scenarios/</code>.
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {tracks.map((track) => (
                <li key={track.id}>
                  <ScenarioCard track={track} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </SiteChrome>
  );
}
