import { PlayScreen } from "@/components/try/play/PlayScreen";

export default async function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PlayScreen gameId={id} />;
}
