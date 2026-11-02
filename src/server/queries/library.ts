import "server-only";
import { prisma } from "../db";
import { episodeHref, mediaUrl } from "@/lib/media";
import type { HistoryDTO } from "@/types/dto";
import { cardInclude, PUBLISHED, toCard } from "./titles";

const historyInclude = {
  title: { include: cardInclude },
  episode: { include: { season: { select: { number: true } } } },
} as const;

export async function getHistories(userId: string, options: { limit?: number; continueOnly?: boolean } = {}) {
  const rows = await prisma.watchHistory.findMany({
    where: { userId, title: PUBLISHED, ...(options.continueOnly ? { completed: false, position: { gt: 30 } } : {}) },
    orderBy: { updatedAt: "desc" },
    take: options.continueOnly ? 60 : (options.limit ?? 200),
    include: historyInclude,
  });

  const seen = new Set<string>();
  const result: HistoryDTO[] = [];
  for (const row of rows) {
    // "Xem tiếp" chỉ hiện tập gần nhất của mỗi phim bộ
    if (options.continueOnly) {
      if (seen.has(row.titleId)) continue;
      seen.add(row.titleId);
    }
    const season = row.episode?.season.number ?? null;
    const episode = row.episode?.number ?? null;
    result.push({
      id: row.id,
      title: toCard(row.title),
      season,
      episode,
      episodeName: row.episode?.name ?? null,
      position: row.position,
      duration: row.duration,
      completed: row.completed,
      updatedAt: row.updatedAt.toISOString(),
      href:
        row.title.type === "tv" && season !== null && episode !== null
          ? episodeHref(row.title.slug, season, episode)
          : `/movie/${row.title.slug}/player`,
      image: mediaUrl(row.episode?.stillPath) ?? mediaUrl(row.title.backdropPath) ?? mediaUrl(row.title.posterPath),
    });
    if (options.limit && result.length >= options.limit) break;
  }
  return result;
}

export async function getWatchlist(userId: string) {
  const rows = await prisma.watchlistItem.findMany({
    where: { userId, title: PUBLISHED },
    orderBy: { createdAt: "desc" },
    include: { title: { include: cardInclude } },
  });
  return rows.map((r) => toCard(r.title));
}

export async function isInWatchlist(userId: string | undefined, titleId: string) {
  if (!userId) return false;
  return !!(await prisma.watchlistItem.findUnique({ where: { userId_titleId: { userId, titleId } } }));
}
