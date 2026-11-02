import "server-only";
import fs from "node:fs";
import { prisma } from "../db";
import { serverEnv } from "../env";
import { run } from "../media/ffmpeg";
import { ytdlpVersion } from "../media/remote";
import { parseFrames } from "../media/frames";
import { directorySize, ORIGINALS_DIR, PUBLIC_DIR } from "../storage";
import { getTmdbToken } from "../admin/tmdb";
import { mediaUrl } from "@/lib/media";
import type { Prisma } from "@/generated/prisma/client";
import { ACTIVE_VIDEO_STATUSES, type VideoFrame, type VideoRendition, type VideoStatus } from "@/types/media";

// ---------------------------------------------------------------------------
// Video (dùng chung cho nhiều trang admin)
// ---------------------------------------------------------------------------

export const adminVideoInclude = {
  subtitles: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.VideoInclude;

type VideoRow = Prisma.VideoGetPayload<{ include: typeof adminVideoInclude }>;

export type AdminVideo = ReturnType<typeof toAdminVideo>;

export const toAdminVideo = (v: VideoRow) => ({
  id: v.id,
  originalName: v.originalName,
  size: Number(v.size),
  status: v.status as VideoStatus,
  progress: v.progress,
  stage: v.stage,
  error: v.error,
  mode: v.mode,
  autoCover: v.autoCover,
  duration: v.duration,
  width: v.width,
  height: v.height,
  videoCodec: v.videoCodec,
  audioCodec: v.audioCodec,
  renditions: JSON.parse(v.renditions ?? "[]") as VideoRendition[],
  frames: parseFrames(v.frames).map((f: VideoFrame) => ({ ...f, url: mediaUrl(f.path)! })),
  hlsUrl: v.status === "ready" ? mediaUrl(v.hlsPath) : null,
  storyboardUrl: v.status === "ready" ? mediaUrl(v.storyboardPath) : null,
  subtitles: v.subtitles.map((s) => ({ id: s.id, lang: s.lang, label: s.label, url: mediaUrl(s.path)!, isDefault: s.isDefault })),
  hasSource: !!v.sourcePath,
  sourceUrl: v.sourceUrl,
  sourceSite: v.sourceSite,
  createdAt: v.createdAt.toISOString(),
  finishedAt: v.finishedAt?.toISOString() ?? null,
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

let sizeCache: { at: number; media: number; originals: number } | null = null;
const storageUsage = async () => {
  if (sizeCache && Date.now() - sizeCache.at < 60_000) return sizeCache;
  const [media, originals] = await Promise.all([directorySize(PUBLIC_DIR), directorySize(ORIGINALS_DIR)]);
  sizeCache = { at: Date.now(), media, originals };
  return sizeCache;
};

const diskSpace = async () => {
  try {
    const stat = await fs.promises.statfs(serverEnv.mediaRoot);
    return { free: stat.bavail * stat.bsize, total: stat.blocks * stat.bsize };
  } catch {
    return null;
  }
};

export async function getDashboard() {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - 13);

  const [movies, series, episodes, users, published, queue, failed, views, topTitles, recentVideos, storage, disk] =
    await Promise.all([
      prisma.title.count({ where: { type: "movie" } }),
      prisma.title.count({ where: { type: "tv" } }),
      prisma.episode.count(),
      prisma.user.count(),
      prisma.title.count({ where: { status: "published" } }),
      prisma.video.count({ where: { status: { in: ACTIVE_VIDEO_STATUSES } } }),
      prisma.video.count({ where: { status: "failed" } }),
      prisma.viewEvent.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      prisma.title.findMany({
        where: { viewCount: { gt: 0 } },
        orderBy: { viewCount: "desc" },
        take: 8,
        select: { id: true, title: true, type: true, viewCount: true, posterPath: true },
      }),
      prisma.video.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { title: { select: { id: true, title: true } }, episode: { include: { season: { include: { title: { select: { id: true, title: true } } } } } } },
      }),
      storageUsage(),
      diskSpace(),
    ]);

  // Lượt xem theo ngày (giờ địa phương)
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    return { date: d.toISOString().slice(0, 10), label: `${d.getDate()}/${d.getMonth() + 1}`, count: 0 };
  });
  for (const v of views) {
    const local = new Date(v.createdAt);
    const key = new Date(local.getFullYear(), local.getMonth(), local.getDate()).toISOString().slice(0, 10);
    const day = days.find((d) => d.date === key);
    if (day) day.count++;
  }

  return {
    counts: { movies, series, episodes, users, published, queue, failed },
    viewsByDay: days,
    totalViews14d: views.length,
    topTitles: topTitles.map((t) => ({ ...t, poster: mediaUrl(t.posterPath) })),
    recentVideos: recentVideos.map((v) => ({
      id: v.id,
      originalName: v.originalName,
      status: v.status,
      progress: v.progress,
      createdAt: v.createdAt.toISOString(),
      owner: v.title
        ? { titleId: v.title.id, label: v.title.title }
        : v.episode
          ? { titleId: v.episode.season.title.id, label: `${v.episode.season.title.title} • P${v.episode.season.number} T${v.episode.number}` }
          : null,
    })),
    storage: { media: storage.media, originals: storage.originals, disk },
  };
}

// ---------------------------------------------------------------------------
// Phim
// ---------------------------------------------------------------------------

export async function listTitles(filters: { q?: string; type?: string; status?: string; page?: number }) {
  const pageSize = 20;
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.TitleWhereInput = {
    ...(filters.type === "movie" || filters.type === "tv" ? { type: filters.type } : {}),
    ...(filters.status === "draft" || filters.status === "published" ? { status: filters.status } : {}),
    ...(filters.q ? { OR: [{ title: { contains: filters.q } }, { searchText: { contains: filters.q.toLowerCase() } }] } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.title.count({ where }),
    prisma.title.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        video: { select: { status: true, progress: true } },
        seasons: { select: { episodes: { select: { video: { select: { status: true } } } } } },
      },
    }),
  ]);
  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    items: rows.map((t) => {
      const eps = t.seasons.flatMap((s) => s.episodes);
      return {
        id: t.id,
        slug: t.slug,
        type: t.type as "movie" | "tv",
        title: t.title,
        originalTitle: t.originalTitle,
        year: t.year,
        poster: mediaUrl(t.posterPath),
        status: t.status as "draft" | "published",
        featured: t.featured,
        viewCount: t.viewCount,
        updatedAt: t.updatedAt.toISOString(),
        video: t.video ? { status: t.video.status, progress: t.video.progress } : null,
        episodes: { total: eps.length, ready: eps.filter((e) => e.video?.status === "ready").length },
      };
    }),
  };
}

export async function getTitleForEdit(id: string) {
  const t = await prisma.title.findUnique({
    where: { id },
    include: {
      genres: true,
      credits: { orderBy: { order: "asc" }, include: { person: true } },
      video: { include: adminVideoInclude },
      seasons: {
        orderBy: { number: "asc" },
        include: { episodes: { orderBy: { number: "asc" }, include: { video: { include: adminVideoInclude } } } },
      },
    },
  });
  if (!t) return null;
  return {
    id: t.id,
    type: t.type as "movie" | "tv",
    slug: t.slug,
    status: t.status as "draft" | "published",
    featured: t.featured,
    tmdbId: t.tmdbId,
    viewCount: t.viewCount,
    form: {
      title: t.title,
      slug: t.slug,
      originalTitle: t.originalTitle ?? "",
      tagline: t.tagline ?? "",
      overview: t.overview ?? "",
      releaseDate: t.releaseDate?.toISOString().slice(0, 10) ?? "",
      year: t.year ?? null,
      runtime: t.runtime ?? null,
      ageRating: t.ageRating ?? "",
      quality: t.quality ?? "",
      country: t.country ?? "",
      language: t.language ?? "",
      rating: t.rating,
      voteCount: t.voteCount,
      trailerUrl: t.trailerUrl ?? "",
      imdbId: t.imdbId ?? "",
      seriesStatus: t.seriesStatus ?? "",
      totalEpisodes: t.totalEpisodes ?? null,
      featured: t.featured,
      genreIds: t.genres.map((g) => g.genreId),
    },
    images: { poster: mediaUrl(t.posterPath), backdrop: mediaUrl(t.backdropPath), logo: mediaUrl(t.logoPath) },
    credits: t.credits.map((c) => ({
      id: c.id,
      kind: c.kind,
      character: c.character,
      person: { id: c.person.id, name: c.person.name, profile: mediaUrl(c.person.profilePath) },
    })),
    video: t.video ? toAdminVideo(t.video) : null,
    seasons: t.seasons.map((s) => ({
      id: s.id,
      number: s.number,
      name: s.name,
      overview: s.overview,
      episodes: s.episodes.map((e) => ({
        id: e.id,
        number: e.number,
        name: e.name,
        overview: e.overview,
        runtime: e.runtime,
        airDate: e.airDate?.toISOString().slice(0, 10) ?? null,
        still: mediaUrl(e.stillPath),
        video: e.video ? toAdminVideo(e.video) : null,
      })),
    })),
  };
}

export type TitleForEdit = NonNullable<Awaited<ReturnType<typeof getTitleForEdit>>>;

// ---------------------------------------------------------------------------
// Thư viện video
// ---------------------------------------------------------------------------

export async function listVideos(filters: { status?: string; orphan?: boolean; page?: number }) {
  const pageSize = 30;
  const page = Math.max(1, filters.page ?? 1);
  const where: Prisma.VideoWhereInput = {
    ...(filters.status ? { status: filters.status === "active" ? { in: ACTIVE_VIDEO_STATUSES } : filters.status } : {}),
    ...(filters.orphan ? { title: null, episode: null } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.video.count({ where }),
    prisma.video.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        ...adminVideoInclude,
        title: { select: { id: true, title: true } },
        episode: { include: { season: { include: { title: { select: { id: true, title: true } } } } } },
      },
    }),
  ]);
  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    items: rows.map((v) => ({
      ...toAdminVideo(v),
      owner: v.title
        ? { titleId: v.title.id, label: v.title.title }
        : v.episode
          ? { titleId: v.episode.season.title.id, label: `${v.episode.season.title.title} • Phần ${v.episode.season.number} • Tập ${v.episode.number}` }
          : null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Người dùng & hệ thống
// ---------------------------------------------------------------------------

export async function listUsers(q?: string) {
  const users = await prisma.user.findMany({
    where: q ? { OR: [{ email: { contains: q } }, { name: { contains: q } }] } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { _count: { select: { histories: true, watchlist: true } } },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role ?? "user",
    banned: !!u.banned,
    createdAt: u.createdAt.toISOString(),
    histories: u._count.histories,
    watchlist: u._count.watchlist,
  }));
}

let ffmpegVersion: string | null = null;
export async function getSystemInfo() {
  if (!ffmpegVersion) {
    ffmpegVersion = await run(serverEnv.ffmpegPath, ["-hide_banner", "-version"])
      .then(({ stdout }) => stdout.split("\n")[0]?.replace(/^ffmpeg version\s*/, "").split(" ")[0] ?? "?")
      .catch((error: Error) => `Lỗi: ${error.message}`);
  }
  return {
    ffmpeg: ffmpegVersion,
    ffmpegPath: serverEnv.ffmpegPath,
    encoder: serverEnv.videoEncoder,
    transcodeHeights: serverEnv.transcodeHeights,
    mediaRoot: serverEnv.mediaRoot,
    keepOriginals: serverEnv.keepOriginals,
    workerEnabled: serverEnv.workerEnabled,
    allowSignup: serverEnv.allowSignup,
    tmdbConfigured: !!(await getTmdbToken()),
    ytdlp: await ytdlpVersion(),
    ytdlpPath: serverEnv.ytdlpPath,
    denoConfigured: !!serverEnv.denoPath,
    disk: await diskSpace(),
    node: process.version,
  };
}
