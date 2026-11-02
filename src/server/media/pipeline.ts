import fs from "node:fs";
import path from "node:path";
import { prisma } from "../db";
import { serverEnv } from "../env";
import { privatePath, publicPath, removeQuietly } from "../storage";
import { encoderArgs, extractFrame, ffmpeg, probe, type ProbeResult } from "./ffmpeg";
import { scoreFrame } from "./images";
import { resolveLanguage, TEXT_SUBTITLE_CODECS } from "./subtitles";
import { applyAutoCovers } from "./covers";
import type { VideoFrame, VideoRendition } from "@/types/media";

/** Thang chất lượng: chiều cao danh nghĩa -> khung tối đa (16:9) và bitrate video (kbps). */
const LADDER: Record<number, { width: number; bitrate: number }> = {
  2160: { width: 3840, bitrate: 14000 },
  1440: { width: 2560, bitrate: 9000 },
  1080: { width: 1920, bitrate: 5000 },
  720: { width: 1280, bitrate: 2800 },
  480: { width: 854, bitrate: 1400 },
  360: { width: 640, bitrate: 800 },
};

const FRAME_COUNT = 8;
const STORYBOARD = { cols: 10, rows: 10, width: 160, height: 90 };
const HLS_SEGMENT_SECONDS = 6;

export const videoBaseDir = (videoId: string) => `videos/${videoId}`;

export class JobCancelledError extends Error {}

/** Nhãn chất lượng theo khung 16:9: 1920x800 (phim màn ảnh rộng) vẫn là "1080p". */
const nominalName = (width = 0, height = 0) => {
  const fit = Object.keys(LADDER)
    .map(Number)
    .sort((a, b) => a - b)
    .find((h) => width <= LADDER[h].width * 1.02 && height <= h * 1.02);
  return `${fit ?? height}p`;
};

type Plan = { name: string; boxWidth: number; boxHeight: number; bitrate: number };

const isBrowserSafeH264 = (info: ProbeResult) =>
  info.video?.codec_name === "h264" &&
  (!info.video.pix_fmt || ["yuv420p", "yuvj420p"].includes(info.video.pix_fmt));

/** Chỉ tạo các mức chất lượng không lớn hơn video gốc. */
const buildLadder = (info: ProbeResult, heights: number[]): Plan[] => {
  const srcWidth = info.video?.width ?? 1920;
  const srcHeight = info.video?.height ?? 1080;
  const plans = heights
    .filter((h) => LADDER[h])
    .filter((h) => srcWidth >= LADDER[h].width * 0.9 || srcHeight >= h * 0.9)
    .map((h) => ({ name: `${h}p`, boxWidth: LADDER[h].width, boxHeight: h, bitrate: LADDER[h].bitrate }));
  if (plans.length) return plans;
  // Video nhỏ hơn mọi mức: giữ nguyên kích thước gốc
  const nominal = Object.keys(LADDER).map(Number).sort((a, b) => a - b).find((h) => h >= srcHeight) ?? 360;
  return [{ name: nominalName(srcWidth, srcHeight), boxWidth: srcWidth, boxHeight: srcHeight, bitrate: LADDER[nominal].bitrate }];
};

const hlsOutputArgs = (streamMap: string) => [
  "-f", "hls",
  "-hls_time", String(HLS_SEGMENT_SECONDS),
  "-hls_playlist_type", "vod",
  "-hls_flags", "independent_segments",
  "-hls_segment_type", "mpegts",
  "-hls_segment_filename", "hls/%v/seg_%05d.ts",
  "-master_pl_name", "master.m3u8",
  "-var_stream_map", streamMap,
  "hls/%v/index.m3u8",
];

/** Nguồn để trích khung hình: file gốc nếu còn, không thì playlist HLS chất lượng cao nhất. */
export const frameSourceFor = (video: { sourcePath: string | null; hlsPath: string | null; renditions: string | null }) => {
  if (video.sourcePath) {
    const source = privatePath(video.sourcePath);
    if (fs.existsSync(source)) return source;
  }
  if (video.hlsPath) {
    const renditions = JSON.parse(video.renditions ?? "[]") as VideoRendition[];
    const top = renditions[0]?.name;
    if (top) return publicPath(video.hlsPath.replace(/master\.m3u8$/, `${top}/index.m3u8`));
  }
  return null;
};

/**
 * Xử lý một video: probe -> ảnh bìa -> phụ đề nhúng -> storyboard -> HLS.
 */
export async function processVideo(videoId: string) {
  const video = await prisma.video.findUniqueOrThrow({ where: { id: videoId } });
  if (!video.sourcePath) throw new Error("Video không còn file gốc để xử lý");
  const source = privatePath(video.sourcePath);
  if (!fs.existsSync(source)) throw new Error(`Không tìm thấy file gốc: ${video.sourcePath}`);

  const baseRel = videoBaseDir(videoId);
  const baseAbs = publicPath(baseRel);
  const controller = new AbortController();
  const state = { stage: "probe", progress: 0 };
  const setStage = (stage: string, progress: number) => Object.assign(state, { stage, progress });

  // Ghi tiến độ định kỳ và phát hiện khi admin huỷ/xoá video.
  const ticker = setInterval(async () => {
    try {
      const current = await prisma.video.findUnique({ where: { id: videoId }, select: { status: true } });
      if (!current || current.status !== "processing") {
        controller.abort();
        return;
      }
      await prisma.video.update({
        where: { id: videoId },
        data: { stage: state.stage, progress: Math.round(state.progress * 10) / 10 },
      });
    } catch {
      // bỏ qua lỗi tạm thời khi ghi tiến độ
    }
  }, 2000);

  const guard = <T>(promise: Promise<T>) =>
    promise.catch((error) => {
      if (controller.signal.aborted) throw new JobCancelledError("Đã huỷ");
      throw error;
    });

  try {
    // 1. Đọc thông tin
    const info = await probe(source);
    if (!info.video) throw new Error("File không có luồng video");
    const duration = info.duration || 0;
    await prisma.video.update({
      where: { id: videoId },
      data: {
        duration,
        width: info.video.width,
        height: info.video.height,
        videoCodec: info.video.codec_name,
        audioCodec: info.audio?.codec_name ?? null,
      },
    });

    // Dọn kết quả cũ (giữ phụ đề admin đã upload)
    for (const dir of ["hls", "storyboard", "frames", "subs/embedded"]) {
      await removeQuietly(path.join(/*turbopackIgnore: true*/ baseAbs, dir));
    }
    await prisma.subtitle.deleteMany({ where: { videoId, path: { startsWith: `${baseRel}/subs/embedded/` } } });
    for (const dir of ["hls", "storyboard", "frames", "subs/embedded"]) {
      await fs.promises.mkdir(path.join(/*turbopackIgnore: true*/ baseAbs, dir), { recursive: true });
    }

    // 2. Khung hình ứng viên cho ảnh bìa
    setStage("covers", 2);
    const frames: VideoFrame[] = [];
    const count = duration < 20 ? 3 : FRAME_COUNT;
    for (let i = 0; i < count; i++) {
      const time = duration > 0 ? duration * (0.06 + (0.84 * i) / Math.max(1, count - 1)) : 0;
      const file = `frames/f${String(i + 1).padStart(2, "0")}.jpg`;
      try {
        await guard(extractFrame(source, time, path.join(baseAbs, file), 1920, duration < 20 ? 1 : 30));
        frames.push({ path: `${baseRel}/${file}`, time: Math.round(time), score: await scoreFrame(path.join(baseAbs, file)) });
      } catch (error) {
        if (error instanceof JobCancelledError) throw error;
      }
      setStage("covers", 2 + (6 * (i + 1)) / count);
    }

    // 3. Phụ đề nhúng trong file (mkv...) -> WebVTT
    setStage("subtitles", 8);
    const textSubs = info.subtitleStreams.filter((s) => TEXT_SUBTITLE_CODECS.has(s.codec_name ?? ""));
    if (textSubs.length) {
      const args = ["-i", source];
      for (const s of textSubs) args.push("-map", `0:${s.index}`, "-c:s", "webvtt", `subs/embedded/${s.index}.vtt`);
      try {
        await guard(ffmpeg(args, { cwd: baseAbs, signal: controller.signal }));
        const hasDefault = await prisma.subtitle.count({ where: { videoId, isDefault: true } });
        let defaultAssigned = hasDefault > 0;
        for (const s of textSubs) {
          const lang = resolveLanguage(s.tags?.language);
          const isDefault = !defaultAssigned && lang.code === "vi";
          defaultAssigned ||= isDefault;
          await prisma.subtitle.create({
            data: {
              videoId,
              lang: lang.code,
              label: s.tags?.title || lang.label,
              path: `${baseRel}/subs/embedded/${s.index}.vtt`,
              isDefault,
            },
          });
        }
      } catch (error) {
        if (error instanceof JobCancelledError) throw error;
        // phụ đề lỗi không làm hỏng cả video
      }
    }

    // 4. Storyboard: ảnh xem trước khi tua (chỉ giải mã keyframe nên rất nhanh)
    setStage("storyboard", 10);
    let storyboardPath: string | null = null;
    if (duration > 0) {
      const interval = duration > 3600 ? 10 : duration > 600 ? 5 : 2;
      const { cols, rows, width, height } = STORYBOARD;
      try {
        await guard(
          ffmpeg(
            [
              "-skip_frame", "nokey",
              "-i", source,
              "-vf", `fps=1/${interval},scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,tile=${cols}x${rows}`,
              "-fps_mode", "vfr",
              "-q:v", "6",
              "storyboard/sb_%03d.jpg",
            ],
            { cwd: baseAbs, signal: controller.signal },
          ),
        );
        const sprites = (await fs.promises.readdir(path.join(baseAbs, "storyboard"))).filter((f) => f.endsWith(".jpg")).length;
        const tiles = Math.min(Math.ceil(duration / interval), sprites * cols * rows);
        const ts = (sec: number) => new Date(Math.min(sec, duration) * 1000).toISOString().slice(11, 23);
        let vtt = "WEBVTT\n\n";
        for (let i = 0; i < tiles; i++) {
          const sprite = Math.floor(i / (cols * rows)) + 1;
          const cell = i % (cols * rows);
          const x = (cell % cols) * width;
          const y = Math.floor(cell / cols) * height;
          vtt += `${ts(i * interval)} --> ${ts((i + 1) * interval)}\nsb_${String(sprite).padStart(3, "0")}.jpg#xywh=${x},${y},${width},${height}\n\n`;
        }
        await fs.promises.writeFile(path.join(baseAbs, "storyboard", "storyboard.vtt"), vtt, "utf-8");
        storyboardPath = `${baseRel}/storyboard/storyboard.vtt`;
      } catch (error) {
        if (error instanceof JobCancelledError) throw error;
      }
    }

    // 5. HLS
    setStage("transcode", 15);
    let mode = video.mode;
    const safeH264 = isBrowserSafeH264(info);
    if (mode === "copy" && !safeH264) mode = "auto";
    if (mode === "auto") mode = safeH264 ? "copy" : "single";

    const audio = info.audio;
    const args = ["-i", source];
    let renditions: VideoRendition[];

    if (mode === "copy") {
      const name = nominalName(info.video.width, info.video.height);
      args.push("-map", `0:${info.video.index}`);
      if (audio) args.push("-map", `0:${audio.index}`);
      args.push("-c:v", "copy");
      if (audio) args.push(...(audio.codec_name === "aac" ? ["-c:a", "copy"] : ["-c:a", "aac", "-b:a", "192k", "-ac", "2"]));
      args.push("-sn", "-dn", ...hlsOutputArgs(audio ? `v:0,a:0,name:${name}` : `v:0,name:${name}`));
      renditions = [
        { name, width: info.video.width ?? 0, height: info.video.height ?? 0, bandwidth: info.bitRate },
      ];
    } else {
      // "single": một mức duy nhất (tối đa 1080p) cho file không phải H.264; "transcode": đủ thang chất lượng
      const plans =
        mode === "single"
          ? buildLadder(info, [1080, 720, 480, 360]).slice(0, 1)
          : buildLadder(info, serverEnv.transcodeHeights);
      const n = plans.length;
      const scale = (p: Plan) =>
        `scale=w=${p.boxWidth}:h=${p.boxHeight}:force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p`;
      const filter =
        n === 1
          ? `[0:${info.video.index}]${scale(plans[0])}[v0]`
          : `[0:${info.video.index}]split=${n}${plans.map((_, i) => `[s${i}]`).join("")};` +
            plans.map((p, i) => `[s${i}]${scale(p)}[v${i}]`).join(";");
      args.push("-filter_complex", filter);
      plans.forEach((p, i) =>
        args.push(
          "-map", `[v${i}]`,
          `-b:v:${i}`, `${p.bitrate}k`,
          `-maxrate:v:${i}`, `${Math.round(p.bitrate * 1.07)}k`,
          `-bufsize:v:${i}`, `${p.bitrate * 2}k`,
        ),
      );
      if (audio) {
        plans.forEach(() => args.push("-map", `0:${audio.index}`));
        args.push("-c:a", "aac", "-b:a", "160k", "-ac", "2");
      }
      args.push(
        ...encoderArgs(serverEnv.videoEncoder),
        "-force_key_frames", `expr:gte(t,n_forced*2)`,
        "-sc_threshold", "0",
        "-sn", "-dn",
        ...hlsOutputArgs(plans.map((p, i) => (audio ? `v:${i},a:${i},name:${p.name}` : `v:${i},name:${p.name}`)).join(" ")),
      );
      renditions = plans.map((p) => {
        const ratio = Math.min(p.boxWidth / (info.video!.width ?? p.boxWidth), p.boxHeight / (info.video!.height ?? p.boxHeight), 1);
        return {
          name: p.name,
          width: Math.round(((info.video!.width ?? p.boxWidth) * ratio) / 2) * 2,
          height: Math.round(((info.video!.height ?? p.boxHeight) * ratio) / 2) * 2,
          bandwidth: p.bitrate * 1000,
        };
      });
    }

    await guard(
      ffmpeg(args, {
        cwd: baseAbs,
        duration,
        signal: controller.signal,
        onProgress: (ratio) => setStage("transcode", 15 + ratio * 84),
      }),
    );
    if (!fs.existsSync(path.join(baseAbs, "hls", "master.m3u8"))) throw new Error("ffmpeg không tạo được master.m3u8");

    // 6. Hoàn tất
    clearInterval(ticker);
    const updated = await prisma.video.update({
      where: { id: videoId },
      data: {
        status: "ready",
        stage: "done",
        progress: 100,
        error: null,
        mode: video.mode,
        hlsPath: `${baseRel}/hls/master.m3u8`,
        renditions: JSON.stringify(renditions),
        frames: JSON.stringify(frames),
        storyboardPath,
        finishedAt: new Date(),
      },
      include: { title: true, episode: true },
    });

    // Cập nhật thời lượng nếu chưa nhập
    const minutes = Math.max(1, Math.round(duration / 60));
    if (updated.title && !updated.title.runtime) {
      await prisma.title.update({ where: { id: updated.title.id }, data: { runtime: minutes } });
    }
    if (updated.episode && !updated.episode.runtime) {
      await prisma.episode.update({ where: { id: updated.episode.id }, data: { runtime: minutes } });
    }

    await applyAutoCovers(videoId);

    if (!serverEnv.keepOriginals) {
      await removeQuietly(path.dirname(source));
      await prisma.video.update({ where: { id: videoId }, data: { sourcePath: null } });
    }
  } finally {
    clearInterval(ticker);
  }
}
