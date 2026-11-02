import { notFound } from "next/navigation";
import Player from "@/components/sections/Player/Player";
import { getEpisodePlayback } from "@/server/queries/playback";
import { getSession, isAdminUser } from "@/server/session";
import type { Params } from "@/types/dto";

export const dynamic = "force-dynamic";

export default async function EpisodePlayerPage({
  params,
}: Params<{ slug: string; season: string; episode: string }>) {
  const { slug, season, episode } = await params;
  const session = await getSession();
  const playback = await getEpisodePlayback(
    slug,
    Number(season),
    Number(episode),
    session?.user.id,
    isAdminUser(session?.user),
  );
  if (!playback) notFound();
  return <Player key={playback.episodeId} playback={playback} />;
}
