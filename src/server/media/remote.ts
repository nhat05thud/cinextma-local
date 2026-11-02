import fs from "node:fs";
import path from "node:path";
import { prisma } from "../db";
import { serverEnv } from "../env";
import { ORIGINALS_DIR, publicPath, removeQuietly } from "../storage";
import { run } from "./ffmpeg";
import { JobCancelledError, videoBaseDir } from "./pipeline";
import { resolveLanguage } from "./subtitles";
import { parseEpisodeFromName, parseMovieFileName } from "@/lib/filename";
import { BLOB_HELP, NOT_FOUND_HELP, SNIFF_FAILED_HELP, isBlobUrl, isMediaUrl } from "@/lib/remote-help";
import { sniffMedia, type SniffResult, type SniffedMedia } from "./sniff";

/*
 * Lấy video từ website khác bằng yt-dlp (hỗ trợ hơn 1000 website + link file video trực tiếp).
 * yt-dlp không vượt DRM: video có DRM sẽ báo lỗi.
 */

export type RemoteEntry = {
  url: string;
  /** Referer riêng của video này (trang có nhiều trình phát nhúng từ các nguồn khác nhau) */
  referer?: string | null;
  title: string;
  duration: number | null;
  thumbnail: string | null;
  season: number;
  episode: number;
};

export type RemoteInfo = {
  url: string;
  /** Trang chứa video, gửi kèm làm Referer khi tải (chống hotlink) */
  referer: string | null;
  /** Các link video bắt được bằng trình duyệt ẩn (khi trang tạo link bằng JavaScript) */
  detected: Pick<SniffedMedia, "url" | "referer" | "kind" | "master" | "fromBody">[];
  site: string;
  siteKey: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  duration: number | null;
  year: number | null;
  isPlaylist: boolean;
  entries: RemoteEntry[];
};

export type DownloadOptions = { quality: string; subtitles: boolean; referer?: string | null };

export const QUALITY_FORMATS: Record<string, string> = {
  // H.264 tốt nhất (thường tối đa 1080p): đóng gói HLS trong vài giây, không cần chuyển mã
  auto: "bv*[vcodec^=avc1]+ba[acodec^=mp4a]/b[vcodec^=avc1]/bv*+ba/b",
  // Chất lượng cao nhất (có thể 4K VP9/AV1): phải chuyển mã, chậm
  best: "bv*+ba/b",
};
const formatFor = (quality: string) => {
  if (QUALITY_FORMATS[quality]) return QUALITY_FORMATS[quality];
  const h = Number(quality) || 1080;
  return `bv*[height<=${h}][vcodec^=avc1]+ba[acodec^=mp4a]/b[height<=${h}][vcodec^=avc1]/bv*[height<=${h}]+ba/b[height<=${h}]/b`;
};

const SITE_NAMES: Record<string, string> = {
  youtube: "YouTube",
  youtubetab: "YouTube",
  vimeo: "Vimeo",
  dailymotion: "Dailymotion",
  facebook: "Facebook",
  tiktok: "TikTok",
  bilibili: "Bilibili",
  archiveorg: "Internet Archive",
  twitch: "Twitch",
  instagram: "Instagram",
  twitter: "X (Twitter)",
  generic: "Link trực tiếp",
};

/** Tham số chung: Deno cho YouTube, ffmpeg để ghép video + âm thanh. */
const baseArgs = () => {
  const args = ["--no-colors", "--ignore-config"];
  if (serverEnv.denoPath) args.push("--js-runtimes", `deno:${serverEnv.denoPath}`);
  if (path.isAbsolute(serverEnv.ffmpegPath)) args.push("--ffmpeg-location", path.dirname(serverEnv.ffmpegPath));
  return args;
};

export const validateRemoteUrl = (raw: string) => {
  if (isBlobUrl(raw)) throw new Error(BLOB_HELP);
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Link không hợp lệ");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Chỉ hỗ trợ link http:// hoặc https://");
  return url.toString();
};

/** Nhiều máy chủ video chỉ cho tải khi request kèm trang gốc (chống hotlink). */
const refererArgs = (referer: string | null | undefined) =>
  referer ? ["--referer", referer, "--add-header", `Origin:${new URL(referer).origin}`] : [];

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const decodeEntities = (text: string) =>
  text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

type PageInfo = { title: string | null; image: string | null; description: string | null; media: string[] };

/**
 * Đọc HTML của trang: tên phim / ảnh / mô tả từ thẻ meta, và các link .m3u8/.mpd/.mp4 lộ trong trang
 * (kể cả dạng https:\/\/... trong JSON của script). Link do JavaScript tự tạo lúc chạy thì không thấy được.
 */
async function readPage(pageUrl: string): Promise<PageInfo | null> {
  try {
    const response = await fetch(pageUrl, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok || !(response.headers.get("content-type") ?? "").includes("html")) return null;
    const html = (await response.text()).slice(0, 3_000_000);
    const meta = (name: string) =>
      (
        new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)`, "i").exec(html) ??
        new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, "i").exec(html)
      )?.[1] ?? null;
    const rawTitle = meta("og:title") ?? /<title[^>]*>([^<]*)/i.exec(html)?.[1] ?? null;
    const title = rawTitle ? cleanPageTitle(decodeEntities(rawTitle)) : null;
    const image = meta("og:image");
    const description = meta("og:description") ?? meta("description");
    const media = [
      ...new Set(
        [...html.replace(/\\\//g, "/").matchAll(/https?:\/\/[^\s"'<>\\]+?\.(?:m3u8|mpd|mp4)(?:\?[^\s"'<>\\]*)?/gi)].map((m) =>
          decodeEntities(m[0]),
        ),
      ),
    ];
    return {
      title,
      image: image ? new URL(decodeEntities(image), pageUrl).toString() : null,
      description: description ? decodeEntities(description).trim() : null,
      media,
    };
  } catch {
    return null;
  }
}

/** Ưu tiên playlist HLS tổng (master) > HLS > DASH > MP4. */
const rankMedia = (links: string[]) =>
  [...links].sort((a, b) => {
    const score = (u: string) => (/master\.m3u8/i.test(u) ? 0 : /\.m3u8/i.test(u) ? 1 : /\.mpd/i.test(u) ? 2 : 3);
    return score(a) - score(b);
  });

/** Lỗi yt-dlp -> câu thông báo dễ hiểu. */
const friendlyError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (/DRM/i.test(message)) return "Video được bảo vệ DRM, không thể tải về.";
  if (/Unsupported URL/i.test(message)) return NOT_FOUND_HELP;
  if (/HTTP Error 403|Forbidden/i.test(message))
    return "Máy chủ video từ chối tải (lỗi 403). Điền link trang chứa video vào ô “Trang chứa video” rồi thử lại.";
  if (/Private video|login|sign in|cookies/i.test(message)) return "Video yêu cầu đăng nhập hoặc là video riêng tư.";
  if (/HTTP Error 404|not found/i.test(message)) return "Không tìm thấy trang (lỗi 404).";
  if (/timed? ?out|aborted/i.test(message)) return "Website phản hồi quá lâu, vui lòng thử lại.";
  const line = message.split("\n").find((l) => l.includes("ERROR:")) ?? message;
  return line.replace(/^.*ERROR:\s*/, "").slice(0, 300);
};

type YtEntry = {
  _type?: string;
  url?: string;
  webpage_url?: string;
  title?: string;
  duration?: number;
  thumbnail?: string;
  thumbnails?: { url: string; width?: number }[];
  season_number?: number;
  episode_number?: number;
  formats?: { url?: string }[];
};

const bestThumbnail = (entry: YtEntry) =>
  entry.thumbnail ??
  [...(entry.thumbnails ?? [])].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ??
  null;

/** "Xem Tên phim - Full | Website" -> "Tên phim" */
const cleanPageTitle = (raw: string) =>
  raw
    .split(/\s+[|–—-]\s+/)[0]
    .replace(/^\s*(xem phim|xem|watch)\s+/i, "")
    .trim() || null;

/** Báo lỗi kèm những gì trình duyệt ẩn đã thấy, để biết vì sao không dò được. */
const sniffFailedMessage = (sniffed: SniffResult, pageUrl: string) => {
  if (sniffed.challenge) {
    return (
      `Trang đang bật xác minh chống bot (“${sniffed.title}”, ô “Xác minh bạn là con người”) nên máy chủ không vào được. ` +
      "Hãy mở trang bằng trình duyệt của bạn, xác minh, rồi dán vào đây link bài gốc (ví dụ link tweet x.com/…/status/…, " +
      "YouTube…) hoặc link .m3u8/.mp4 copy từ F12 → Network (kèm link trang ở ô “Trang chứa video”)."
    );
  }
  const seen = [
    sniffed.title ? `trang “${sniffed.title}”` : "trang không có tiêu đề",
    sniffed.finalUrl !== pageUrl ? `đã chuyển tới ${sniffed.finalUrl}` : null,
    sniffed.players.length ? `có ${sniffed.players.length} khung trình phát (${sniffed.players.join(", ")})` : "không thấy khung trình phát",
    `${sniffed.frames} khung nhúng`,
  ].filter(Boolean);
  return `${SNIFF_FAILED_HELP} (Trình duyệt ẩn thấy: ${seen.join(", ")}.)`;
};

/** Đọc thông tin video / playlist từ link (không tải video). */
export async function analyzeRemote(raw: string, refererRaw?: string | null): Promise<RemoteInfo> {
  let url = validateRemoteUrl(raw);
  let referer = refererRaw?.trim() ? validateRemoteUrl(refererRaw) : null;
  let page: PageInfo | null = null;
  /** Trang dùng để lấy tên phim / ảnh / mô tả (khác Referer khi trình phát nằm trong iframe) */
  let metaPage: string | null = null;
  let detected: SniffedMedia[] = [];
  let sniffedTitle: string | null = null;

  /** Nhiều video tự dò được trên cùng trang (đã kiểm tra bằng yt-dlp), theo thứ tự trên trang */
  let multi: { media: SniffedMedia; data: Awaited<ReturnType<typeof probe>> }[] = [];

  const probe = async (target: string, ref = referer) => {
    const { stdout } = await run(
      serverEnv.ytdlpPath,
      [...baseArgs(), ...refererArgs(ref), "-J", "--flat-playlist", "--no-warnings", "--playlist-end", "300", "--", target],
      { signal: AbortSignal.timeout(120_000) },
    );
    return JSON.parse(stdout) as YtEntry & {
      _type?: string;
      extractor_key?: string;
      webpage_url_domain?: string;
      description?: string;
      release_year?: number;
      entries?: YtEntry[];
    };
  };

  let data: Awaited<ReturnType<typeof probe>>;
  try {
    data = await probe(url);
  } catch (error) {
    // Trang yt-dlp không hỗ trợ, hoặc bộ đọc chung bị chặn (403 Cloudflare...) -> tự tìm link video
    if (!/Unsupported URL|\[generic\]/i.test(String(error)) || isMediaUrl(url)) throw new Error(friendlyError(error));
    // yt-dlp không nhận ra trang -> 1) tìm link video lộ trong HTML
    const pageUrl = url;
    page = await readPage(pageUrl);
    let candidates: SniffedMedia[] = rankMedia(page?.media ?? []).map((link) => ({
      url: link,
      referer: pageUrl,
      kind: /\.m3u8/i.test(link) ? "hls" : /\.mpd/i.test(link) ? "dash" : "mp4",
      master: /master\.m3u8/i.test(link),
      size: 0,
      fromBody: false,
    }));
    if (!candidates.length) {
      // 2) link do JavaScript tạo lúc chạy (video hiện dạng blob:): mở trang bằng trình duyệt ẩn, cuộn hết trang,
      //    bấm lần lượt mọi trình phát, bắt request mạng
      const sniffed = await sniffMedia(pageUrl).catch((e: Error) => {
        throw new Error(`Không tự dò được video: ${e.message}`);
      });
      if (!sniffed.media.length) throw new Error(sniffFailedMessage(sniffed, pageUrl));
      detected = sniffed.media;
      sniffedTitle = sniffed.title;
      candidates = sniffed.media;
    }
    metaPage = pageUrl;

    // Kiểm tra từng link bằng yt-dlp (song song, tối đa 4): lấy thời lượng, bỏ link hỏng / hết hạn,
    // bỏ playlist con đã nằm trong playlist tổng của link khác
    const checked: typeof multi = [];
    let firstError: unknown = null;
    const queue = candidates.slice(0, 15);
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(4, queue.length) }, async () => {
        while (next < queue.length) {
          const media = queue[next++];
          const result = await probe(media.url, media.referer ?? pageUrl).catch((e) => {
            firstError ??= e;
            return null;
          });
          if (result) checked.push({ media, data: result });
        }
      }),
    );
    checked.sort((a, b) => queue.indexOf(a.media) - queue.indexOf(b.media));
    const key = (link: string) => link.replace(/[?#].*$/, "");
    multi = checked.filter(
      (item) => !checked.some((other) => other !== item && (other.data.formats ?? []).some((f) => f.url && key(f.url) === key(item.media.url))),
    );
    if (!multi.length) throw new Error(friendlyError(firstError));
    data = multi[0].data;
    url = multi[0].media.url;
    referer = multi[0].media.referer ?? pageUrl;
  }

  const siteKey = (data.extractor_key ?? "generic").toLowerCase();
  const site =
    siteKey === "generic"
      ? `Link trực tiếp (${referer ? new URL(referer).hostname : (data.webpage_url_domain ?? new URL(url).hostname)})`
      : (SITE_NAMES[siteKey] ?? (data.extractor_key ?? "").replace(/(Tab|Playlist|Channel|User)$/, ""));
  // Trang có nhiều trình phát -> coi như playlist để chọn lấy hết một lần
  const fromPage = multi.length > 1;
  const isPlaylist = data._type === "playlist" || fromPage;

  const raws: (YtEntry & { referer?: string | null })[] = fromPage
    ? multi.map(({ media, data: item }) => ({ ...item, url: media.url, referer: media.referer ?? referer, title: undefined }))
    : isPlaylist
      ? (data.entries ?? []).filter((e) => e && e._type !== "playlist" && (e.url ?? e.webpage_url)?.startsWith("http"))
      : [{ ...data, url: data.webpage_url ?? url }];

  const entries: RemoteEntry[] = raws.map((entry, index) => {
    const title = (entry.title ?? `Video ${index + 1}`).trim();
    const guess = parseEpisodeFromName(title, 1, index + 1);
    return {
      url: (entry.url ?? entry.webpage_url)!,
      ...(entry.referer ? { referer: entry.referer } : {}),
      title: siteKey === "generic" ? parseMovieFileName(title).title : title,
      duration: entry.duration ? Math.round(entry.duration) : null,
      thumbnail: bestThumbnail(entry),
      season: entry.season_number ?? guess.season,
      episode: entry.episode_number ?? guess.episode,
    };
  });
  // Số tập đoán từ tiêu đề bị trùng -> đánh số theo thứ tự trong playlist
  const keys = entries.map((e) => `${e.season}-${e.episode}`);
  if (new Set(keys).size !== keys.length) entries.forEach((e, i) => Object.assign(e, { season: 1, episode: i + 1 }));

  const cleaned = siteKey === "generic" ? parseMovieFileName(data.title ?? "") : { title: data.title ?? "", year: null };
  let title = cleaned.title.trim() || "Không tên";
  let description: string | null = data.description?.trim() || null;
  let thumbnail: string | null = bestThumbnail(data) ?? entries[0]?.thumbnail ?? null;

  // Link .m3u8/.mp4 thường chỉ tên "index"/"master": lấy tên phim, ảnh, mô tả từ trang chứa video
  if (siteKey === "generic" && (metaPage ?? referer)) {
    page ??= await readPage((metaPage ?? referer)!);
    const pageTitle = page?.title ?? (sniffedTitle ? cleanPageTitle(sniffedTitle) : null);
    if (pageTitle) {
      title = parseMovieFileName(pageTitle).title;
      if (!isPlaylist && entries[0]) entries[0].title = title;
    }
    description ??= page?.description ?? null;
    thumbnail ??= page?.image ?? null;
  }
  // Video lấy từ các trình phát trên cùng trang: đặt tên theo tên phim
  if (fromPage) entries.forEach((e, i) => (e.title = `${title} - Video ${i + 1}`));

  return {
    url,
    referer,
    detected: detected.map(({ url, referer, kind, master, fromBody }) => ({ url, referer, kind, master, fromBody })),
    site,
    siteKey,
    title,
    description: description?.slice(0, 3000) ?? null,
    thumbnail,
    duration: data.duration ? Math.round(data.duration) : null,
    year: data.release_year ?? cleaned.year ?? null,
    isPlaylist,
    entries,
  };
}

/**
 * Tải video từ link nguồn về originals/<videoId>/source.<ext>, kèm phụ đề nếu có,
 * rồi chuyển video sang hàng đợi xử lý (HLS, ảnh bìa...).
 */
export async function downloadRemoteVideo(videoId: string) {
  const video = await prisma.video.findUniqueOrThrow({ where: { id: videoId } });
  if (!video.sourceUrl) throw new Error("Video không có link nguồn");
  const options: DownloadOptions = { quality: "auto", subtitles: true, ...JSON.parse(video.downloadOptions ?? "{}") };
  const dir = path.join(ORIGINALS_DIR, videoId);
  await removeQuietly(dir);
  await fs.promises.mkdir(dir, { recursive: true });

  const controller = new AbortController();
  const state = { parts: 1, done: 0, current: 0 };
  const percent = () => Math.min(99, ((state.done + state.current) / state.parts) * 100);

  // Ghi tiến độ định kỳ; admin huỷ/xoá video -> dừng yt-dlp
  const ticker = setInterval(async () => {
    try {
      const current = await prisma.video.findUnique({ where: { id: videoId }, select: { status: true } });
      if (!current || current.status !== "downloading") {
        controller.abort();
        return;
      }
      await prisma.video.update({ where: { id: videoId }, data: { stage: "download", progress: Math.round(percent() * 10) / 10 } });
    } catch {
      // bỏ qua lỗi tạm thời
    }
  }, 2000);

  try {
    await run(
      serverEnv.ytdlpPath,
      [
        ...baseArgs(),
        ...refererArgs(options.referer),
        "--no-playlist",
        "--newline",
        "--no-mtime",
        "--progress-template",
        "download:CXP|%(progress.status)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s",
        "-f",
        formatFor(options.quality),
        "--merge-output-format",
        "mp4/mkv",
        ...(options.subtitles ? ["--write-subs", "--sub-langs", "vi.*,en.*", "--convert-subs", "vtt"] : []),
        "-o",
        path.join(dir, "source.%(ext)s"),
        "--",
        video.sourceUrl,
      ],
      {
        signal: controller.signal,
        onStdoutLine: (line) => {
          // "Downloading 1 format(s): 137+140" -> tải 2 phần (hình + tiếng) rồi ghép
          const formats = /Downloading \d+ format\(s\): (\S+)/.exec(line);
          if (formats) state.parts = formats[1].split("+").length;
          const match = /^CXP\|(\w+)\|(\S+)\|(\S+)\|(\S+)/.exec(line);
          if (!match) return;
          const [, status, downloaded, total, estimate] = match;
          const size = Number(total) || Number(estimate);
          if (status === "finished") {
            state.done = Math.min(state.parts, state.done + 1);
            state.current = 0;
          } else if (size > 0) {
            state.current = Math.min(1, Number(downloaded) / size);
          }
        },
      },
    );
  } catch (error) {
    clearInterval(ticker);
    if (controller.signal.aborted) {
      await removeQuietly(dir);
      throw new JobCancelledError("Đã huỷ tải");
    }
    throw new Error(friendlyError(error));
  } finally {
    clearInterval(ticker);
  }

  // File video đã tải (bỏ qua phụ đề, file tạm)
  const files = await fs.promises.readdir(dir);
  const sourceFile = files.find((f) => f.startsWith("source.") && !/\.(vtt|srt|part|ytdl|json|jpg|webp|png)$/i.test(f));
  if (!sourceFile) throw new Error("Không tìm thấy file video sau khi tải");
  const stat = await fs.promises.stat(path.join(dir, sourceFile));

  // Phụ đề lấy kèm: source.<lang>.vtt -> public/videos/<id>/subs/
  const subs = files.filter((f) => /^source\..+\.vtt$/i.test(f));
  if (subs.length) {
    const subsDir = publicPath(`${videoBaseDir(videoId)}/subs`);
    await fs.promises.mkdir(subsDir, { recursive: true });
    let hasDefault = (await prisma.subtitle.count({ where: { videoId, isDefault: true } })) > 0;
    for (const file of subs) {
      const code = file.split(".")[1] ?? "und";
      const lang = resolveLanguage(code.split("-")[0]);
      const name = `src-${code.replace(/[^\w-]/g, "")}.vtt`;
      await fs.promises.rename(path.join(dir, file), path.join(subsDir, name));
      const isDefault = !hasDefault && lang.code === "vi";
      hasDefault ||= isDefault;
      await prisma.subtitle.create({
        data: { videoId, lang: lang.code, label: lang.label, path: `${videoBaseDir(videoId)}/subs/${name}`, isDefault },
      });
    }
  }

  await prisma.video.updateMany({
    where: { id: videoId, status: "downloading" },
    data: {
      sourcePath: `originals/${videoId}/${sourceFile}`,
      size: BigInt(stat.size),
      status: "queued",
      stage: null,
      progress: 0,
    },
  });
}

/** Phiên bản yt-dlp (hiện trong trang Cài đặt). */
export const ytdlpVersion = () =>
  run(serverEnv.ytdlpPath, ["--version"])
    .then(({ stdout }) => stdout.trim())
    .catch((error: Error) => `Lỗi: ${error.message}`);

/** Cập nhật yt-dlp lên bản mới nhất (website thay đổi thường xuyên nên cần cập nhật định kỳ). */
export const updateYtdlp = () =>
  run(serverEnv.ytdlpPath, ["-U"], { signal: AbortSignal.timeout(180_000) }).then(({ stdout, stderr }) =>
    (stdout + stderr).trim().split(/\r?\n/).slice(-3).join("\n"),
  );
