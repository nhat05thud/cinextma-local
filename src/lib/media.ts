/** URL public của file trong MEDIA_ROOT/public. */
export const mediaUrl = (path: string | null | undefined) => {
  if (!path) return null;
  if (/^(https?:)?\/\//.test(path) || path.startsWith("/")) return path;
  return `/media/${path.split("/").map(encodeURIComponent).join("/")}`;
};

/** Ảnh có fallback (dùng cho thẻ phim chưa có poster). */
export const imageUrl = (path: string | null | undefined, fallback = "/images/no-poster.svg") =>
  mediaUrl(path) ?? fallback;

export const titleHref = (title: { type: string; slug: string }) =>
  title.type === "tv" ? `/tv/${title.slug}` : `/movie/${title.slug}`;

export const episodeHref = (slug: string, season: number, episode: number) =>
  `/tv/${slug}/${season}/${episode}/player`;

/** Lấy video id từ link YouTube để nhúng trailer. */
export const youtubeId = (url: string | null | undefined) => {
  if (!url) return null;
  const match =
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(url) ??
    /^([\w-]{11})$/.exec(url.trim());
  return match?.[1] ?? null;
};
