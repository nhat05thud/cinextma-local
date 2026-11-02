export type ContentType = "movie" | "tv";

export type Params<T> = { params: Promise<T> };
export type SearchParams = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export type ActionResult<T = null> = {
  success: boolean;
  message?: string;
  data?: T;
};

export type GenreDTO = { name: string; slug: string };

/** Dữ liệu tối thiểu để hiển thị một thẻ phim (poster) và thẻ hover. */
export type TitleCardDTO = {
  id: string;
  slug: string;
  type: ContentType;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  poster: string | null;
  backdrop: string | null;
  logo: string | null;
  year: number | null;
  rating: number;
  ageRating: string | null;
  quality: string | null;
  runtime: number | null;
  genres: GenreDTO[];
  /** Phim bộ: "Tập 5/12", "Hoàn tất (12/12)"... */
  episodeLabel: string | null;
  playable: boolean;
  /** Đường dẫn trang xem đầu tiên (phim lẻ hoặc tập đầu) */
  playHref: string | null;
};

export type PersonCreditDTO = {
  id: string;
  name: string;
  profile: string | null;
  character: string | null;
};

export type EpisodeDTO = {
  id: string;
  number: number;
  name: string | null;
  overview: string | null;
  still: string | null;
  runtime: number | null;
  airDate: string | null;
  playable: boolean;
};

export type SeasonDTO = {
  id: string;
  number: number;
  name: string | null;
  overview: string | null;
  poster: string | null;
  episodes: EpisodeDTO[];
};

export type TitleDetailDTO = TitleCardDTO & {
  tagline: string | null;
  releaseDate: string | null;
  country: string | null;
  language: string | null;
  voteCount: number;
  trailerUrl: string | null;
  viewCount: number;
  seriesStatus: string | null;
  totalEpisodes: number | null;
  cast: PersonCreditDTO[];
  directors: PersonCreditDTO[];
  writers: PersonCreditDTO[];
  seasons: SeasonDTO[];
};

export type SubtitleTrackDTO = { src: string; lang: string; label: string; isDefault: boolean };

export type PlaybackDTO = {
  titleId: string;
  episodeId: string | null;
  type: ContentType;
  title: string;
  /** Ví dụ "Phần 1 - Tập 3: Tên tập" */
  subtitle: string | null;
  slug: string;
  status: "ready" | "processing" | "failed" | "missing";
  progress: number;
  src: string | null;
  poster: string | null;
  storyboard: string | null;
  tracks: SubtitleTrackDTO[];
  startAt: number;
  detailHref: string;
  next: { href: string; label: string } | null;
  prev: { href: string; label: string } | null;
  seasons: SeasonDTO[];
  currentSeason: number | null;
  currentEpisode: number | null;
};

export type HistoryDTO = {
  id: string;
  title: TitleCardDTO;
  season: number | null;
  episode: number | null;
  episodeName: string | null;
  position: number;
  duration: number;
  completed: boolean;
  updatedAt: string;
  href: string;
  image: string | null;
};

export type HomeRowDTO = {
  key: string;
  name: string;
  href: string | null;
  items: TitleCardDTO[];
};
