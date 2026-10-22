import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { AccountChip } from "@/components/auth/AccountChip";

/** Shared shell — header width is always the same so nav doesn't jump between pages. */
export function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-[var(--vw-bg)] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 480px at 15% -10%, rgba(15,157,138,0.32), transparent 55%), radial-gradient(700px 420px at 92% 8%, rgba(59,130,246,0.14), transparent 50%), linear-gradient(180deg, #0f1218 0%, #151a22 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage:
            "radial-gradient(ellipse at center, black 18%, transparent 78%)",
        }}
      />

      <header className="relative z-10 border-b border-white/[0.06]">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-[10px] text-sm font-bold"
              style={{
                background: "linear-gradient(145deg, #0f9d8a 0%, #0b6e8a 100%)",
              }}
            >
              V
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide">VibeWork</div>
              <div className="text-[11px] text-white/40">Workplace practice</div>
            </div>
          </Link>
          <Suspense
            fallback={
              <div className="h-9 w-24 animate-pulse rounded-full bg-white/5" />
            }
          >
            <AccountChip />
          </Suspense>
        </div>
      </header>

      <div className="relative z-10">{children}</div>
    </div>
  );
}
