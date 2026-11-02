// Không import "server-only": file này còn được gọi từ script kiểm thử chạy bằng tsx.
import { prisma } from "../db";
import { attachVideo } from "../media/attach";
import { downloadImage } from "../media/images";
import { validateRemoteUrl, type DownloadOptions } from "../media/remote";
import { wakeWorker } from "../media/worker";
import { refreshSearchText, uniqueTitleSlug } from "./slug";

export type RemoteImportItem = {
  url: string;
  /** Referer riêng của video (trang có nhiều trình phát nhúng từ các nguồn khác nhau) */
  referer?: string | null;
  title: string;
  season: number;
  episode: number;
  thumbnail: string | null;
};

export type RemoteImportInput = {
  site: string;
  target:
    | { kind: "new"; type: "movie" | "tv"; title: string; year: number | null; overview: string | null }
    /** Playlist gồm nhiều phim riêng: mỗi video thành một phim lẻ (tên lấy theo tiêu đề video) */
    | { kind: "movies" }
    | { kind: "existing"; titleId: string };
  items: RemoteImportItem[];
  /** Ảnh dùng làm poster/ảnh nền khi chọn "ảnh từ trang nguồn" */
  thumbnail: string | null;
  quality: string;
  /** source: ảnh từ trang nguồn | auto: tự tạo từ khung hình video | none: admin tự tải lên */
  cover: "source" | "auto" | "none";
  subtitles: boolean;
  mode: string;
  /** Trang chứa video (Referer) khi link là file .m3u8/.mp4 lấy từ F12 */
  referer?: string | null;
};

/** Ảnh nguồn lỗi (link hết hạn...) thì bỏ qua, không làm hỏng cả lượt nhập. */
const tryImage = (url: string | null, kind: "poster" | "backdrop" | "still") =>
  url ? downloadImage(url, kind, { smartCrop: kind === "poster" }).catch(() => null) : Promise.resolve(null);

/**
 * Tạo (hoặc dùng) phim, tạo tập nếu là phim bộ, rồi xếp từng video vào hàng đợi tải về.
 * Worker tự tải -> xử lý HLS -> gắn vào phim.
 */
export async function importFromRemote(input: RemoteImportInput): Promise<{ titleId: string; count: number }> {
  const items = input.items.map((item) => ({
    ...item,
    url: validateRemoteUrl(item.url),
    referer: item.referer ? validateRemoteUrl(item.referer) : null,
  }));
  if (!items.length) throw new Error("Chưa chọn video nào");

  // Mỗi video thành một phim lẻ riêng
  if (input.target.kind === "movies") {
    const created: string[] = [];
    for (const item of items) {
      const result = await importFromRemote({
        ...input,
        target: { kind: "new", type: "movie", title: item.title, year: null, overview: null },
        items: [item],
        thumbnail: item.thumbnail ?? input.thumbnail,
      });
      created.push(result.titleId);
    }
    return { titleId: created[0], count: created.length };
  }

  let title;
  if (input.target.kind === "existing") {
    title = await prisma.title.findUniqueOrThrow({ where: { id: input.target.titleId } });
  } else {
    const name = input.target.title.trim();
    if (!name) throw new Error("Vui lòng nhập tên phim");
    title = await prisma.title.create({
      data: {
        type: input.target.type,
        title: name,
        year: input.target.year,
        overview: input.target.overview?.trim() || null,
        slug: await uniqueTitleSlug(name),
        status: "draft",
      },
    });
  }
  if (title.type === "movie" && items.length > 1) throw new Error("Phim lẻ chỉ chọn 1 video. Hãy chọn loại Phim bộ để lấy nhiều tập.");

  // Ảnh bìa từ trang nguồn: chỉ điền ô còn trống
  if (input.cover === "source") {
    const [posterPath, backdropPath] = await Promise.all([
      title.posterPath ? null : tryImage(input.thumbnail, "poster"),
      title.backdropPath ? null : tryImage(input.thumbnail, "backdrop"),
    ]);
    if (posterPath || backdropPath) {
      title = await prisma.title.update({
        where: { id: title.id },
        data: { ...(posterPath ? { posterPath } : {}), ...(backdropPath ? { backdropPath } : {}) },
      });
    }
  }

  const options: DownloadOptions = {
    quality: input.quality,
    subtitles: input.subtitles,
    referer: input.referer ? validateRemoteUrl(input.referer) : null,
  };
  const createVideo = (item: RemoteImportItem) =>
    prisma.video.create({
      data: {
        originalName: item.title.slice(0, 200),
        sourceUrl: item.url,
        sourceSite: input.site.slice(0, 100),
        downloadOptions: JSON.stringify({ ...options, referer: item.referer ?? options.referer }),
        status: "download_queued",
        mode: ["auto", "copy", "transcode"].includes(input.mode) ? input.mode : "auto",
        // "source"/"none": không tự tạo ảnh từ khung hình (ảnh nguồn đã được điền ở trên)
        autoCover: input.cover === "auto",
      },
    });

  if (title.type === "movie") {
    const video = await createVideo(items[0]);
    await attachVideo(video.id, "title", title.id);
  } else {
    for (const item of items) {
      const season = await prisma.season.upsert({
        where: { titleId_number: { titleId: title.id, number: item.season } },
        update: {},
        create: { titleId: title.id, number: item.season, name: `Phần ${item.season}` },
      });
      const existing = await prisma.episode.findUnique({
        where: { seasonId_number: { seasonId: season.id, number: item.episode } },
      });
      const stillPath = input.cover === "source" && !existing?.stillPath ? await tryImage(item.thumbnail, "still") : null;
      const episode = await prisma.episode.upsert({
        where: { seasonId_number: { seasonId: season.id, number: item.episode } },
        update: { ...(existing?.name ? {} : { name: item.title }), ...(stillPath ? { stillPath } : {}) },
        create: { seasonId: season.id, number: item.episode, name: item.title, ...(stillPath ? { stillPath } : {}) },
      });
      const video = await createVideo(item);
      await attachVideo(video.id, "episode", episode.id);
    }
  }

  await refreshSearchText(title.id);
  wakeWorker();
  return { titleId: title.id, count: items.length };
}
