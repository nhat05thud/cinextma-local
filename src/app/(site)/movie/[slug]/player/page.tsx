import { notFound } from "next/navigation";
import Player from "@/components/sections/Player/Player";
import { getMoviePlayback } from "@/server/queries/playback";
import { getSession, isAdminUser } from "@/server/session";
import type { Params } from "@/types/dto";

export const dynamic = "force-dynamic";

export default async function MoviePlayerPage({ params }: Params<{ slug: string }>) {
  const { slug } = await params;
  const session = await getSession();
  const playback = await getMoviePlayback(slug, session?.user.id, isAdminUser(session?.user));
  if (!playback) notFound();
  return <Player key={playback.titleId} playback={playback} />;
}
