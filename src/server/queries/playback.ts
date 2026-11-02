import "server-only";
import { prisma } from "../db";
import { episodeHref, mediaUrl } from "@/lib/media";
import type { PlaybackDTO, SubtitleTrackDTO } from "@/types/dto";
import { PUBLISHED, toSeasons } from "./titles";
import { parseFrames, bestFrame } from "../media/frames";

type VideoWithSubs = {
  id: string;
  status: string;
  progress: number;
  hlsPath: string | null;
  storyboardPath: string | null;
  frames: string | null;
  subtitles: { path: string; lang: string; label: string; isDefault: boolean }[];
} | null;

const videoSelect = {
  select: {
    id: true,
    status: true,
    progress: true,
    hlsPath: true,
    storyboardPath: true,
    frames: true,
    subtitles: { orderBy: { createdAt: "asc" as const } },
  },
};

const videoFields = (video: VideoWithSubs) => {
  const tracks: SubtitleTrackDTO[] = (video?.subtitles ?? []).map((s) => ({
    src: mediaUrl(s.path)!,
    lang: s.lang,
    label: s.label,
    isDefault: s.isDefault,
  }));
  // Chỉ một track được default
  const firstDefault = tracks.findIndex((t) => t.isDefault);
  tracks.forEach((t, i) => (t.isDefault = i === firstDefault));

  return {
    status: (video ? (video.status === "ready" ? "ready" : video.status === "failed" ? "failed" : "processing") : "missing") as PlaybackDTO["status"],
    progress: video?.progress ?? 0,
    src: video?.status === "ready" ? mediaUrl(video.hlsPath) : null,
    storyboard: video?.status === "ready" ? mediaUrl(video.storyboardPath) : null,
    framePoster: mediaUrl(bestFrame(parseFrames(video?.frames))?.path),
    tracks,
  };
};

const lastPosition = async (userId: string | undefined, mediaKey: string) => {
  if (!userId) return 0;
  const history = await prisma.watchHistory.findUnique({ where: { userId_mediaKey: { userId, mediaKey } } });
  if (!history || history.completed) return 0;
  return history.position;
};

export async function getMoviePlayback(slug: string, userId?: string, includeDraft = false): Promise<PlaybackDTO | null> {
  const title = await prisma.title.findUnique({
    where: { slug },
    include: { video: videoSelect },
  });
  if (!title || title.type !== "movie" || (!includeDraft && title.status !== PUBLISHED.status)) return null;
  const { framePoster, ...fields } = videoFields(title.video);

  return {
    titleId: title.id,
    episodeId: null,
    type: "movie",
    title: title.title,
    subtitle: title.originalTitle && title.originalTitle !== title.title ? title.originalTitle : null,
    slug: title.slug,
    ...fields,
    poster: mediaUrl(title.backdropPath) ?? framePoster,
    startAt: await lastPosition(userId, title.id),
    detailHref: `/movie/${title.slug}`,
    next: null,
    prev: null,
    seasons: [],
    currentSeason: null,
    currentEpisode: null,
  };
}

export async function getEpisodePlayback(
  slug: string,
  seasonNumber: number,
  episodeNumber: number,
  userId?: string,
  includeDraft = false,
): Promise<PlaybackDTO | null> {
  const title = await prisma.title.findUnique({
    where: { slug },
    include: {
      seasons: {
        orderBy: { number: "asc" },
        include: {
          episodes: {
            orderBy: { number: "asc" },
            include: { video: videoSelect },
          },
        },
      },
    },
  });
  if (!title || title.type !== "tv" || (!includeDraft && title.status !== PUBLISHED.status)) return null;

  // Danh sách tập theo thứ tự để tìm tập trước/sau (chỉ tập đã sẵn sàng)
  const ordered = title.seasons.flatMap((s) => s.episodes.map((e) => ({ season: s, episode: e })));
  const index = ordered.findIndex((x) => x.season.number === seasonNumber && x.episode.number === episodeNumber);
  if (index < 0) return null;
  const { season, episode } = ordered[index];
  const { framePoster, ...fields } = videoFields(episode.video);

  const link = (x: (typeof ordered)[number] | undefined) =>
    x && x.episode.video?.status === "ready"
      ? {
          href: episodeHref(title.slug, x.season.number, x.episode.number),
          label: `Phần ${x.season.number} - Tập ${x.episode.number}${x.episode.name ? `: ${x.episode.name}` : ""}`,
        }
      : null;
  const nextReady = ordered.slice(index + 1).find((x) => x.episode.video?.status === "ready");
  const prevReady = ordered.slice(0, index).reverse().find((x) => x.episode.video?.status === "ready");

  return {
    titleId: title.id,
    episodeId: episode.id,
    type: "tv",
    title: title.title,
    subtitle: `${title.seasons.length > 1 ? `Phần ${season.number} - ` : ""}Tập ${episode.number}${episode.name ? `: ${episode.name}` : ""}`,
    slug: title.slug,
    ...fields,
    poster: mediaUrl(episode.stillPath) ?? framePoster ?? mediaUrl(title.backdropPath),
    startAt: await lastPosition(userId, `${title.id}:${episode.id}`),
    detailHref: `/tv/${title.slug}`,
    next: link(nextReady),
    prev: link(prevReady),
    seasons: toSeasons(
      title.seasons.map((s) => ({
        ...s,
        episodes: s.episodes.map((e) => ({ ...e, video: e.video ? { status: e.video.status } : null })),
      })),
    ),
    currentSeason: season.number,
    currentEpisode: episode.number,
  };
}
