import Link from "next/link";

export default function TrackNotFound() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6 text-white">
      <h1 className="text-2xl font-semibold">Scenario not found</h1>
      <p className="mt-3 text-sm text-white/55">
        That track isn&apos;t in the catalog.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center justify-center rounded-xl bg-[var(--vw-accent)] px-4 py-3 text-[15px] font-semibold text-white"
      >
        Browse scenarios
      </Link>
    </main>
  );
}
