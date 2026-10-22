import { Suspense } from "react";
import { notFound } from "next/navigation";
import { WorkspaceApp } from "@/components/workspace/WorkspaceApp";
import { toPublicPayload } from "@/lib/engine/public";
import { getDayRun } from "@/lib/engine/store";

function PlayFallback() {
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-[var(--vw-bg)] text-sm text-white/60">
      Opening workspace…
    </div>
  );
}

async function PlaySession({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const run = getDayRun(runId);
  if (!run) notFound();
  return <WorkspaceApp initial={toPublicPayload(run)} />;
}

export default function PlayPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  return (
    <Suspense fallback={<PlayFallback />}>
      <PlaySession params={params} />
    </Suspense>
  );
}
