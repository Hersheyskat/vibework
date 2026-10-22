import Link from "next/link";

export default function PlayNotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--vw-bg)] px-6 text-center text-white">
      <h1 className="text-2xl font-semibold">Session not found</h1>
      <p className="mt-2 max-w-sm text-sm text-white/55">
        This day run is missing or expired. Start a fresh Day 1 from the home
        screen.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-xl bg-[var(--vw-accent)] px-4 py-2.5 text-sm font-semibold text-white"
      >
        Back to start
      </Link>
    </div>
  );
}
