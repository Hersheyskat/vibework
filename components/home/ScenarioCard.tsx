import Link from "next/link";
import type { CatalogTrack } from "@/lib/scenarios/catalog";

export function ScenarioCard({ track }: { track: CatalogTrack }) {
  return (
    <Link
      href={`/tracks/${track.id}`}
      className="group vw-animate-in block rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition duration-300 hover:-translate-y-0.5 hover:border-[var(--vw-accent)]/40 hover:bg-white/[0.06]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--vw-accent)]">
            {track.role}
          </p>
          <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-white">
            {track.companyName}
          </h3>
        </div>
        <span className="shrink-0 rounded-lg bg-white/5 px-2 py-1 text-[11px] text-white/45">
          {track.dayCount} days
        </span>
      </div>
      <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-white/50">
        {track.oneLiner}
      </p>
      <div className="mt-4 flex items-center justify-between text-[13px] font-medium text-white/70 transition group-hover:text-[var(--vw-accent)]">
        <span>{track.title}</span>
        <span aria-hidden className="transition group-hover:translate-x-0.5">
          →
        </span>
      </div>
    </Link>
  );
}
