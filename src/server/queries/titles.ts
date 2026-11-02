import "server-only";
import { cache } from "react";
import { prisma } from "../db";
import type { Prisma } from "@/generated/prisma/client";
import { countryName, normalizeSearch } from "@/lib/catalog";
import { episodeHref } from "@/lib/media";
import { mediaUrl } from "@/lib/media";
import type {
  ContentType,
  HomeRowDTO,
  PersonCreditDTO,
  SeasonDTO,
  TitleCardDTO,
  TitleDetailDTO,
} from "@/types/dto";

export const PUBLISHED = { status: "published" } satisfies Prisma.TitleWhereInput;

export const cardInclude = {
  genres: { include: { genre: true } },
  video: { select: { status: true } },
  seasons: {
    orderBy: { number: "asc" },
    select: {
      number: true,
      episodes: {
        orderBy: { number: "asc" },
        select: { number: true, video: { select: { status: true } } },
      },
    },
  },
} satisfies Prisma.TitleInclude;

export type CardTitle = Prisma.TitleGetPayload<{ include: typeof cardInclude }>;

const ready = (video: { status: string } | null | undefined) => video?.status === "ready";

export const toCard = (t: CardTitle): TitleCardDTO => {
  const type = t.type as ContentType;
  let episodeLabel: string | null = null;
  let playHref: string | null = null;

  if (type === "tv") {
    const available = t.seasons.flatMap((s) =>
      s.episodes.filter((e) => ready(e.video)).map((e) => ({ season: s.number, episode: e.number })),
    );
    const count = available.length;
    const total = t.totalEpisodes ?? null;
    episodeLabel =
      t.seriesStatus === "completed"
        ? `Hoàn tất (${count}/${total ?? count})`
        : count
          ? `Tập ${count}${total ? `/${total}` : ""}`
          : "Sắp chiếu";
    if (available[0]) playHref = episodeHref(t.slug, available[0].season, available[0].episode);
  } else if (ready(t.video)) {
    playHref = `/movie/${t.slug}/player`;
  }

  return {
    id: t.id,
    slug: t.slug,
    type,
    title: t.title,
    originalTitle: t.originalTitle,
    overview: t.overview,
    poster: mediaUrl(t.posterPath),
    backdrop: mediaUrl(t.backdropPath),
    logo: mediaUrl(t.logoPath),
    year: t.year,
    rating: t.rating,
    ageRating: t.ageRating,
    quality: t.quality,
    runtime: t.runtime,
    genres: t.genres
      .map((g) => g.genre)
      .sort((a, b) => a.position - b.position)
      .map((g) => ({ name: g.name, slug: g.slug })),
    episodeLabel,
    playable: !!playHref,
    playHref,
  };
};

const findCards = async (args: Omit<Prisma.TitleFindManyArgs, "include">) =>
  (await prisma.title.findMany({ ...args, include: cardInclude })).map(toCard);

// ---------------------------------------------------------------------------
// Trang chủ
// ---------------------------------------------------------------------------

export const getFeatured = async (limit = 6) => {
  const featured = await findCards({
    where: { ...PUBLISHED, featured: true },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });
  if (featured.length) return featured;
  return findCards({
    where: { ...PUBLISHED, backdropPath: { not: null } },
    orderBy: { publishedAt: "desc" },
    take: Math.min(limit, 5),
  });
};

export const getHomeRows = async (limit = 20): Promise<HomeRowDTO[]> => {
  const [latest, movies, series, popular, topRated, collections, genreCounts] = await Promise.all([
    findCards({ where: PUBLISHED, orderBy: { publishedAt: "desc" }, take: limit }),
    findCards({ where: { ...PUBLISHED, type: "movie" }, orderBy: { publishedAt: "desc" }, take: limit }),
    findCards({ where: { ...PUBLISHED, type: "tv" }, orderBy: { updatedAt: "desc" }, take: limit }),
    findCards({ where: { ...PUBLISHED, viewCount: { gt: 0 } }, orderBy: { viewCount: "desc" }, take: limit }),
    findCards({ where: { ...PUBLISHED, rating: { gt: 0 } }, orderBy: [{ rating: "desc" }, { voteCount: "desc" }], take: limit }),
    prisma.collection.findMany({
      where: { active: true },
      orderBy: { position: "asc" },
      include: {
        items: {
          where: { title: PUBLISHED },
          orderBy: { position: "asc" },
          take: limit,
          include: { title: { include: cardInclude } },
        },
      },
    }),
    prisma.genre.findMany({
      select: { name: true, slug: true, _count: { select: { titles: { where: { title: PUBLISHED } } } } },
    }),
  ]);

  const topGenres = genreCounts
    .filter((g) => g._count.titles >= 4)
    .sort((a, b) => b._count.titles - a._count.titles)
    .slice(0, 3);
  const genreRows = await Promise.all(
    topGenres.map(async (g) => ({
      key: `genre-${g.slug}`,
      name: `Phim ${g.name}`,
      href: `/discover?genre=${g.slug}`,
      items: await findCards({
        where: { ...PUBLISHED, genres: { some: { genre: { slug: g.slug } } } },
        orderBy: { publishedAt: "desc" },
        take: limit,
      }),
    })),
  );

  const rows: HomeRowDTO[] = [
    { key: "latest", name: "Mới cập nhật", href: "/discover?sort=latest", items: latest },
    ...collections.map((c) => ({
      key: `collection-${c.slug}`,
      name: c.name,
      href: null,
      items: c.items.map((i) => toCard(i.title)),
    })),
    { key: "movies", name: "Phim lẻ mới", href: "/discover?type=movie", items: movies },
    { key: "series", name: "Phim bộ mới", href: "/discover?type=tv", items: series },
    { key: "popular", name: "Xem nhiều nhất", href: "/discover?sort=views", items: popular },
    { key: "top-rated", name: "Đánh giá cao", href: "/discover?sort=rating", items: topRated },
    ...genreRows,
  ];
  // Bỏ hàng trống và hàng trùng hoàn toàn với "Mới cập nhật" khi kho phim còn ít
  const latestIds = latest.map((t) => t.id).join();
  return rows.filter(
    (row) => row.items.length > 0 && (row.key === "latest" || row.items.map((t) => t.id).join() !== latestIds),
  );
};

// ---------------------------------------------------------------------------
// Khám phá & tìm kiếm
// ---------------------------------------------------------------------------

export type DiscoverFilters = {
  type?: string;
  genre?: string;
  country?: string;
  year?: number;
  sort?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

const SORTS: Record<string, Prisma.TitleOrderByWithRelationInput[]> = {
  latest: [{ publishedAt: "desc" }],
  views: [{ viewCount: "desc" }],
  rating: [{ rating: "desc" }, { voteCount: "desc" }],
  year: [{ year: "desc" }, { publishedAt: "desc" }],
  title: [{ title: "asc" }],
};

export const discoverTitles = async (filters: DiscoverFilters) => {
  const pageSize = filters.pageSize ?? 24;
  const page = Math.max(1, filters.page ?? 1);
  const terms = normalizeSearch(filters.q ?? "").split("-").filter(Boolean);

  const where: Prisma.TitleWhereInput = {
    ...PUBLISHED,
    ...(filters.type === "movie" || filters.type === "tv" ? { type: filters.type } : {}),
    ...(filters.genre ? { genres: { some: { genre: { slug: filters.genre } } } } : {}),
    ...(filters.country ? { country: filters.country } : {}),
    ...(filters.year ? { year: filters.year } : {}),
    ...(terms.length ? { AND: terms.map((term) => ({ searchText: { contains: term } })) } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.title.count({ where }),
    findCards({
      where,
      orderBy: SORTS[filters.sort ?? ""] ?? SORTS.latest,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { items, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
};

export const getFilterOptions = cache(async () => {
  const [genres, countries, years] = await Promise.all([
    prisma.genre.findMany({
      where: { titles: { some: { title: PUBLISHED } } },
      orderBy: { position: "asc" },
      select: { name: true, slug: true },
    }),
    prisma.title.findMany({ where: { ...PUBLISHED, country: { not: null } }, distinct: ["country"], select: { country: true } }),
    prisma.title.findMany({ where: { ...PUBLISHED, year: { not: null } }, distinct: ["year"], select: { year: true }, orderBy: { year: "desc" } }),
  ]);
  return {
    genres,
    countries: countries.map((c) => c.country!).sort((a, b) => a.localeCompare(b, "vi")),
    years: years.map((y) => y.year!),
  };
});

// ---------------------------------------------------------------------------
// Chi tiết phim
// ---------------------------------------------------------------------------

const detailInclude = {
  ...cardInclude,
  credits: { orderBy: { order: "asc" }, include: { person: true } },
  seasons: {
    orderBy: { number: "asc" },
    include: {
      episodes: { orderBy: { number: "asc" }, include: { video: { select: { status: true } } } },
    },
  },
} satisfies Prisma.TitleInclude;

type DetailTitle = Prisma.TitleGetPayload<{ include: typeof detailInclude }>;

export const toSeasons = (seasons: DetailTitle["seasons"], onlyPlayable = false): SeasonDTO[] =>
  seasons
    .map((s) => ({
      id: s.id,
      number: s.number,
      name: s.name,
      overview: s.overview,
      poster: mediaUrl(s.posterPath),
      episodes: s.episodes
        .map((e) => ({
          id: e.id,
          number: e.number,
          name: e.name,
          overview: e.overview,
          still: mediaUrl(e.stillPath),
          runtime: e.runtime,
          airDate: e.airDate?.toISOString() ?? null,
          playable: ready(e.video),
        }))
        .filter((e) => !onlyPlayable || e.playable),
    }))
    .filter((s) => !onlyPlayable || s.episodes.length > 0);

const toCredit = (c: DetailTitle["credits"][number]): PersonCreditDTO => ({
  id: c.person.id,
  name: c.person.name,
  profile: mediaUrl(c.person.profilePath),
  character: c.character,
});

/** Lấy chi tiết phim theo slug. Admin xem được cả bản nháp. */
export const getTitleDetail = cache(
  async (slug: string, type: ContentType, includeDraft = false): Promise<TitleDetailDTO | null> => {
    const t = await prisma.title.findUnique({ where: { slug }, include: detailInclude });
    if (!t || t.type !== type || (!includeDraft && t.status !== "published")) return null;
    return {
      ...toCard(t),
      tagline: t.tagline,
      releaseDate: t.releaseDate?.toISOString() ?? null,
      country: countryName(t.country),
      language: t.language,
      voteCount: t.voteCount,
      trailerUrl: t.trailerUrl,
      viewCount: t.viewCount,
      seriesStatus: t.seriesStatus,
      totalEpisodes: t.totalEpisodes,
      cast: t.credits.filter((c) => c.kind === "cast").map(toCredit),
      directors: t.credits.filter((c) => c.kind === "director").map(toCredit),
      writers: t.credits.filter((c) => c.kind === "writer").map(toCredit),
      seasons: toSeasons(t.seasons),
    };
  },
);

export const getRelated = async (title: { id: string; genres: { slug: string }[] }, limit = 18) => {
  const related = await findCards({
    where: {
      ...PUBLISHED,
      id: { not: title.id },
      genres: { some: { genre: { slug: { in: title.genres.map((g) => g.slug) } } } },
    },
    orderBy: { viewCount: "desc" },
    take: limit,
  });
  if (related.length >= 6) return related;
  const filler = await findCards({
    where: { ...PUBLISHED, id: { notIn: [title.id, ...related.map((r) => r.id)] } },
    orderBy: { publishedAt: "desc" },
    take: limit - related.length,
  });
  return [...related, ...filler];
};

/** Ảnh poster cho nền trang đăng nhập. */
export const getPosterWall = async (limit = 40) => {
  const titles = await prisma.title.findMany({
    where: { ...PUBLISHED, posterPath: { not: null } },
    select: { posterPath: true },
    orderBy: { viewCount: "desc" },
    take: limit,
  });
  return titles.map((t) => mediaUrl(t.posterPath)!);
};
