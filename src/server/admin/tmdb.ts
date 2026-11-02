import "server-only";
import { prisma } from "../db";
import { serverEnv } from "../env";
import { deleteImage, downloadImage } from "../media/images";
import { TMDB_GENRE_MAP } from "@/lib/catalog";
import { refreshSearchText, uniqueTitleSlug } from "./common";

const API = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";

/** Token: ưu tiên giá trị nhập trong trang Cài đặt, sau đó tới biến môi trường. */
export const getTmdbToken = async () => {
  const setting = await prisma.setting.findUnique({ where: { key: "tmdbToken" } });
  return setting?.value || serverEnv.tmdbToken;
};

const tmdb = async <T>(path: string, params: Record<string, string> = {}): Promise<T> => {
  const token = await getTmdbToken();
  if (!token) throw new Error("Chưa cấu hình TMDB token (Admin → Cài đặt)");
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 401) throw new Error("TMDB token không hợp lệ");
  if (!response.ok) throw new Error(`TMDB lỗi ${response.status}`);
  return (await response.json()) as T;
};

export type TmdbSearchItem = {
  id: number;
  type: "movie" | "tv";
  title: string;
  originalTitle: string;
  year: number | null;
  overview: string;
  poster: string | null;
};

type SearchResponse = {
  results: {
    id: number;
    title?: string;
    name?: string;
    original_title?: string;
    original_name?: string;
    release_date?: string;
    first_air_date?: string;
    overview: string;
    poster_path: string | null;
  }[];
};

export async function searchTmdb(query: string, type: "movie" | "tv"): Promise<TmdbSearchItem[]> {
  const data = await tmdb<SearchResponse>(`/search/${type}`, { query, language: "vi-VN", include_adult: "false" });
  return data.results.slice(0, 12).map((r) => {
    const date = r.release_date || r.first_air_date;
    return {
      id: r.id,
      type,
      title: r.title ?? r.name ?? "",
      originalTitle: r.original_title ?? r.original_name ?? "",
      year: date ? Number(date.slice(0, 4)) : null,
      overview: r.overview,
      poster: r.poster_path ? `${IMG}/w185${r.poster_path}` : null,
    };
  });
}

type Image = { file_path: string; iso_639_1: string | null; vote_average: number; width: number };
type Video = { key: string; site: string; type: string; iso_639_1: string; official: boolean };
type Person = { id: number; name: string; profile_path: string | null; character?: string; job?: string; department?: string; order?: number; roles?: { character: string }[]; jobs?: { job: string }[] };

type Details = {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  tagline?: string;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  runtime?: number;
  episode_run_time?: number[];
  vote_average: number;
  vote_count: number;
  imdb_id?: string;
  original_language: string;
  status: string;
  number_of_episodes?: number;
  genres: { id: number }[];
  production_countries?: { iso_3166_1: string }[];
  origin_country?: string[];
  poster_path: string | null;
  backdrop_path: string | null;
  images?: { posters: Image[]; backdrops: Image[]; logos: Image[] };
  videos?: { results: Video[] };
  credits?: { cast: Person[]; crew: Person[] };
  aggregate_credits?: { cast: Person[]; crew: Person[] };
  release_dates?: { results: { iso_3166_1: string; release_dates: { certification: string }[] }[] };
  content_ratings?: { results: { iso_3166_1: string; rating: string }[] };
  seasons?: { season_number: number; name: string; overview: string; poster_path: string | null; air_date: string | null }[];
  external_ids?: { imdb_id?: string };
};

type SeasonDetails = {
  episodes: { episode_number: number; name: string; overview: string; still_path: string | null; runtime: number | null; air_date: string | null }[];
};

/** Chuyển phân loại độ tuổi của Mỹ/VN sang chuẩn Việt Nam (P, K, T13, T16, T18). */
const toVnRating = (d: Details): string | null => {
  const certs: Record<string, string> = {
    G: "P", PG: "K", "PG-13": "T13", R: "T18", "NC-17": "T18",
    "TV-Y": "P", "TV-Y7": "P", "TV-G": "P", "TV-PG": "K", "TV-14": "T16", "TV-MA": "T18",
  };
  const vn =
    d.release_dates?.results.find((r) => r.iso_3166_1 === "VN")?.release_dates.find((x) => x.certification)?.certification ??
    d.content_ratings?.results.find((r) => r.iso_3166_1 === "VN")?.rating;
  if (vn && ["P", "K", "T13", "T16", "T18", "C13", "C16", "C18"].includes(vn)) return vn.replace(/^C/, "T");
  const us =
    d.release_dates?.results.find((r) => r.iso_3166_1 === "US")?.release_dates.find((x) => x.certification)?.certification ??
    d.content_ratings?.results.find((r) => r.iso_3166_1 === "US")?.rating;
  return us ? (certs[us] ?? null) : null;
};

const pickImage = (images: Image[] | undefined, langs: (string | null)[]) => {
  for (const lang of langs) {
    const found = images?.filter((i) => i.iso_639_1 === lang).sort((a, b) => b.vote_average - a.vote_average)[0];
    if (found) return found.file_path;
  }
  return null;
};

const pickTrailer = (videos: Video[] | undefined) => {
  const youtube = (videos ?? []).filter((v) => v.site === "YouTube" && ["Trailer", "Teaser"].includes(v.type));
  const best =
    youtube.find((v) => v.iso_639_1 === "vi" && v.type === "Trailer") ??
    youtube.find((v) => v.type === "Trailer" && v.official) ??
    youtube.find((v) => v.type === "Trailer") ??
    youtube[0];
  return best ? `https://www.youtube.com/watch?v=${best.key}` : null;
};

const fetchDetails = async (tmdbId: number, type: "movie" | "tv") => {
  const append = type === "movie" ? "credits,images,videos,release_dates" : "aggregate_credits,images,videos,content_ratings,external_ids";
  const params = { language: "vi-VN", append_to_response: append, include_image_language: "vi,en,null", include_video_language: "vi,en" };
  const vi = await tmdb<Details>(`/${type}/${tmdbId}`, params);
  // TMDB thường thiếu bản dịch tiếng Việt: lấy tiếng Anh cho phần còn trống
  if (!vi.overview || !vi.tagline) {
    const en = await tmdb<Details>(`/${type}/${tmdbId}`, { language: "en-US" });
    vi.overview ||= en.overview;
    vi.tagline ||= en.tagline;
  }
  return vi;
};

/** Tìm hoặc tạo người (diễn viên/đạo diễn) theo TMDB id, kèm tải ảnh chân dung. */
const upsertPerson = async (p: Person) => {
  const existing = await prisma.person.findUnique({ where: { tmdbId: p.id } });
  if (existing) return existing;
  const profilePath = p.profile_path ? await downloadImage(`${IMG}/w300${p.profile_path}`, "profile").catch(() => null) : null;
  return prisma.person.create({ data: { name: p.name, tmdbId: p.id, profilePath } });
};

const mapLimit = async <T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) => {
  const results: R[] = [];
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (index < items.length) {
        const i = index++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
};

/**
 * Áp dữ liệu TMDB vào một phim. Nếu `titleId` rỗng thì tạo phim mới (bản nháp).
 * `replaceImages`: thay poster/backdrop/logo hiện có bằng ảnh TMDB.
 */
export async function applyTmdb(options: {
  tmdbId: number;
  type: "movie" | "tv";
  titleId?: string;
  replaceImages?: boolean;
  importEpisodes?: boolean;
}) {
  const { tmdbId, type } = options;
  const d = await fetchDetails(tmdbId, type);
  const existing = options.titleId ? await prisma.title.findUniqueOrThrow({ where: { id: options.titleId } }) : null;
  const titleText = d.title ?? d.name ?? "Không tên";
  const date = d.release_date || d.first_air_date;
  const replace = !existing || options.replaceImages;

  const [posterPath, backdropPath, logoPath] = await Promise.all([
    replace || !existing?.posterPath
      ? (async () => {
          const file = pickImage(d.images?.posters, ["vi", "en", null]) ?? d.poster_path;
          return file ? downloadImage(`${IMG}/w780${file}`, "poster").catch(() => null) : null;
        })()
      : null,
    replace || !existing?.backdropPath
      ? (async () => {
          const file = pickImage(d.images?.backdrops, [null, "en", "vi"]) ?? d.backdrop_path;
          return file ? downloadImage(`${IMG}/original${file}`, "backdrop").catch(() => null) : null;
        })()
      : null,
    replace || !existing?.logoPath
      ? (async () => {
          const file = pickImage(d.images?.logos, ["vi", "en", null]);
          return file ? downloadImage(`${IMG}/w500${file}`, "logo").catch(() => null) : null;
        })()
      : null,
  ]);

  const data = {
    title: titleText,
    originalTitle: d.original_title ?? d.original_name ?? null,
    tagline: d.tagline || null,
    overview: d.overview || null,
    releaseDate: date ? new Date(date) : null,
    year: date ? Number(date.slice(0, 4)) : null,
    runtime: d.runtime || d.episode_run_time?.[0] || existing?.runtime || null,
    ageRating: toVnRating(d) ?? existing?.ageRating ?? null,
    country: d.production_countries?.[0]?.iso_3166_1 ?? d.origin_country?.[0] ?? null,
    language: d.original_language,
    rating: Math.round(d.vote_average * 10) / 10,
    voteCount: d.vote_count,
    trailerUrl: pickTrailer(d.videos?.results) ?? existing?.trailerUrl ?? null,
    tmdbId,
    imdbId: d.imdb_id ?? d.external_ids?.imdb_id ?? null,
    ...(type === "tv"
      ? { totalEpisodes: d.number_of_episodes ?? null, seriesStatus: ["Ended", "Canceled"].includes(d.status) ? "completed" : "ongoing" }
      : {}),
    ...(posterPath ? { posterPath } : {}),
    ...(backdropPath ? { backdropPath } : {}),
    ...(logoPath ? { logoPath } : {}),
  };

  // Phim khác đã dùng tmdbId này -> không gán lại để tránh vi phạm unique
  const duplicate = await prisma.title.findFirst({ where: { type, tmdbId, NOT: existing ? { id: existing.id } : undefined } });
  if (duplicate) {
    if (!existing) throw new Error(`Phim này đã có trong hệ thống: ${duplicate.title}`);
    data.tmdbId = null as unknown as number;
  }

  let titleId: string;
  if (existing) {
    for (const key of ["posterPath", "backdropPath", "logoPath"] as const) {
      if (data[key] && existing[key] && data[key] !== existing[key]) await deleteImage(existing[key]);
    }
    await prisma.title.update({ where: { id: existing.id }, data });
    titleId = existing.id;
  } else {
    const created = await prisma.title.create({
      data: { ...data, type, slug: await uniqueTitleSlug(titleText), status: "draft" },
    });
    titleId = created.id;
  }

  // Thể loại
  const slugs = [...new Set(d.genres.flatMap((g) => TMDB_GENRE_MAP[g.id] ?? []))];
  const genres = await prisma.genre.findMany({ where: { slug: { in: slugs } } });
  await prisma.titleGenre.deleteMany({ where: { titleId } });
  if (genres.length) await prisma.titleGenre.createMany({ data: genres.map((g) => ({ titleId, genreId: g.id })) });

  // Diễn viên & đoàn phim
  const credits = d.credits ?? d.aggregate_credits;
  const cast = (credits?.cast ?? []).slice(0, 15);
  const directors = (credits?.crew ?? []).filter((c) => c.job === "Director" || c.jobs?.some((j) => j.job === "Director")).slice(0, 3);
  const writers = (credits?.crew ?? [])
    .filter((c) => c.department === "Writing")
    .filter((c, i, all) => all.findIndex((x) => x.id === c.id) === i)
    .slice(0, 3);
  await prisma.credit.deleteMany({ where: { titleId } });
  const castPeople = await mapLimit(cast, 6, upsertPerson);
  const directorPeople = await mapLimit(directors, 3, upsertPerson);
  const writerPeople = await mapLimit(writers, 3, upsertPerson);
  await prisma.credit.createMany({
    data: [
      ...castPeople.map((p, i) => ({
        titleId, personId: p.id, kind: "cast", order: i,
        character: cast[i].character ?? cast[i].roles?.[0]?.character ?? null,
      })),
      ...directorPeople.map((p, i) => ({ titleId, personId: p.id, kind: "director", order: i })),
      ...writerPeople.map((p, i) => ({ titleId, personId: p.id, kind: "writer", order: i })),
    ],
  });

  // Phần & tập (bỏ qua "Specials" - season 0). Chỉ thêm tập còn thiếu, không đụng tới video đã upload.
  if (type === "tv" && options.importEpisodes !== false) {
    for (const s of (d.seasons ?? []).filter((s) => s.season_number > 0)) {
      const season = await prisma.season.upsert({
        where: { titleId_number: { titleId, number: s.season_number } },
        update: { name: s.name, overview: s.overview || null },
        create: { titleId, number: s.season_number, name: s.name, overview: s.overview || null, airDate: s.air_date ? new Date(s.air_date) : null },
      });
      const detail = await tmdb<SeasonDetails>(`/tv/${tmdbId}/season/${s.season_number}`, { language: "vi-VN" }).catch(() => null);
      await mapLimit(detail?.episodes ?? [], 4, async (e) => {
        const current = await prisma.episode.findUnique({ where: { seasonId_number: { seasonId: season.id, number: e.episode_number } } });
        const stillPath = !current?.stillPath && e.still_path ? await downloadImage(`${IMG}/w500${e.still_path}`, "still").catch(() => null) : undefined;
        const fields = {
          name: e.name || null,
          overview: e.overview || null,
          runtime: e.runtime ?? null,
          airDate: e.air_date ? new Date(e.air_date) : null,
          ...(stillPath ? { stillPath } : {}),
        };
        await prisma.episode.upsert({
          where: { seasonId_number: { seasonId: season.id, number: e.episode_number } },
          update: fields,
          create: { seasonId: season.id, number: e.episode_number, ...fields },
        });
      });
    }
  }

  await refreshSearchText(titleId);
  return titleId;
}
