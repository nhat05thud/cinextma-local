import fs from "node:fs";
import path from "node:path";
import { prisma } from "../db";
import { serverEnv } from "../env";
import { ORIGINALS_DIR, publicPath, removeQuietly } from "../storage";
import { run } from "./ffmpeg";
import { JobCancelledError, videoBaseDir } from "./pipeline";
import { resolveLanguage } from "./subtitles";
import { parseEpisodeFromName, parseMovieFileName } from "@/lib/filename";

/*
 * Lấy video từ website khác bằng yt-dlp (hỗ trợ hơn 1000 website + link file video trực tiếp).
 * yt-dlp không vượt DRM: video có DRM sẽ báo lỗi.
 */

export type RemoteEntry = {
  url: string;
  title: string;
  duration: number | null;
  thumbnail: string | null;
  season: number;
  episode: number;
};

export type RemoteInfo = {
  url: string;
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

export type DownloadOptions = { quality: string; subtitles: boolean };

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
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Link không hợp lệ");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Chỉ hỗ trợ link http:// hoặc https://");
  return url.toString();
};

/** Lỗi yt-dlp -> câu thông báo dễ hiểu. */
const friendlyError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (/DRM/i.test(message)) return "Video được bảo vệ DRM, không thể tải về.";
  if (/Unsupported URL/i.test(message)) return "Không tìm thấy video nào ở link này (website chưa được hỗ trợ).";
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
};

const bestThumbnail = (entry: YtEntry) =>
  entry.thumbnail ??
  [...(entry.thumbnails ?? [])].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ??
  null;

/** Đọc thông tin video / playlist từ link (không tải video). */
export async function analyzeRemote(raw: string): Promise<RemoteInfo> {
  const url = validateRemoteUrl(raw);
  let stdout: string;
  try {
    ({ stdout } = await run(
      serverEnv.ytdlpPath,
      [...baseArgs(), "-J", "--flat-playlist", "--no-warnings", "--playlist-end", "300", "--", url],
      { signal: AbortSignal.timeout(120_000) },
    ));
  } catch (error) {
    throw new Error(friendlyError(error));
  }
  const data = JSON.parse(stdout) as YtEntry & {
    _type?: string;
    extractor_key?: string;
    webpage_url_domain?: string;
    description?: string;
    release_year?: number;
    entries?: YtEntry[];
  };

  const siteKey = (data.extractor_key ?? "generic").toLowerCase();
  const site =
    siteKey === "generic"
      ? `Link trực tiếp (${data.webpage_url_domain ?? new URL(url).hostname})`
      : (SITE_NAMES[siteKey] ?? (data.extractor_key ?? "").replace(/(Tab|Playlist|Channel|User)$/, ""));
  const isPlaylist = data._type === "playlist";

  const raws: YtEntry[] = isPlaylist
    ? (data.entries ?? []).filter((e) => e && e._type !== "playlist" && (e.url ?? e.webpage_url)?.startsWith("http"))
    : [{ ...data, url: data.webpage_url ?? url }];

  const entries = raws.map((entry, index) => {
    const title = (entry.title ?? `Video ${index + 1}`).trim();
    const guess = parseEpisodeFromName(title, 1, index + 1);
    return {
      url: (entry.url ?? entry.webpage_url)!,
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
  return {
    url,
    site,
    siteKey,
    title: cleaned.title.trim() || "Không tên",
    description: data.description?.trim().slice(0, 3000) || null,
    thumbnail: bestThumbnail(data) ?? entries[0]?.thumbnail ?? null,
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
