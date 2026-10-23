import { Suspense } from "react";
import { PlayScreen } from "@/components/try/play/PlayScreen";

function GameFallback() {
  return (
    <div className="pane">
      <h1>Your work-day</h1>
      <p className="sub">Loading…</p>
    </div>
  );
}

async function GameBody({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlayScreen gameId={id} />;
}

export default function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<GameFallback />}>
      <GameBody params={params} />
    </Suspense>
  );
}
