import { spawn } from "node:child_process";
import { serverEnv } from "../env";

export type ProbeStream = {
  index: number;
  codec_type: "video" | "audio" | "subtitle" | "data" | "attachment";
  codec_name?: string;
  width?: number;
  height?: number;
  pix_fmt?: string;
  channels?: number;
  disposition?: Record<string, number>;
  tags?: Record<string, string>;
};

export type ProbeResult = {
  duration: number;
  bitRate: number;
  formatName: string;
  video?: ProbeStream;
  audio?: ProbeStream;
  audioStreams: ProbeStream[];
  subtitleStreams: ProbeStream[];
};

type RunOptions = {
  cwd?: string;
  signal?: AbortSignal;
  onStdoutLine?: (line: string) => void;
};

/** Dừng tiến trình kèm mọi tiến trình con (yt-dlp sinh ffmpeg con khi ghép/tải HLS). */
export const killTree = (pid: number | undefined) => {
  if (!pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true }).on("error", () => undefined);
  } else {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // tiến trình đã thoát
    }
  }
};

/** Chạy một tiến trình, giữ lại phần cuối stderr để báo lỗi. Huỷ qua `signal` sẽ dừng cả cây tiến trình. */
export const run = (command: string, args: string[], options: RunOptions = {}) =>
  new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    if (options.signal?.aborted) return reject(new Error("Đã huỷ"));
    const child = spawn(command, args, { cwd: options.cwd, windowsHide: true });
    const onAbort = () => killTree(child.pid);
    options.signal?.addEventListener("abort", onAbort, { once: true });
    child.on("close", () => options.signal?.removeEventListener("abort", onAbort));
    let stdout = "";
    let stderr = "";
    let pending = "";

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      if (!options.onStdoutLine) {
        stdout += text;
        return;
      }
      pending += text;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? "";
      lines.forEach(options.onStdoutLine);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-8000);
    });
    child.on("error", (error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new Error(`Không tìm thấy chương trình "${command}". Kiểm tra FFMPEG_PATH / FFPROBE_PATH / YTDLP_PATH trong .env`));
      } else reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else {
        const tail = stderr.trim().split(/\r?\n/).slice(-6).join("\n");
        reject(new Error(`${command.split(/[\\/]/).pop()} thoát với mã ${code}: ${tail}`));
      }
    });
  });

export const probe = async (file: string): Promise<ProbeResult> => {
  const { stdout } = await run(serverEnv.ffprobePath, [
    "-v", "error",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    file,
  ]);
  const data = JSON.parse(stdout) as {
    format?: { duration?: string; bit_rate?: string; format_name?: string };
    streams?: ProbeStream[];
  };
  const streams = data.streams ?? [];
  const videos = streams.filter((s) => s.codec_type === "video" && !s.disposition?.attached_pic);
  const audioStreams = streams.filter((s) => s.codec_type === "audio");
  const audio = audioStreams.find((s) => s.disposition?.default) ?? audioStreams[0];

  return {
    duration: Number(data.format?.duration ?? 0),
    bitRate: Number(data.format?.bit_rate ?? 0),
    formatName: data.format?.format_name ?? "",
    video: videos.find((s) => s.disposition?.default) ?? videos[0],
    audio,
    audioStreams,
    subtitleStreams: streams.filter((s) => s.codec_type === "subtitle"),
  };
};

/**
 * Chạy ffmpeg và báo tiến độ (0..1) dựa trên out_time so với tổng thời lượng.
 */
export const ffmpeg = (
  args: string[],
  options: { cwd?: string; duration?: number; signal?: AbortSignal; onProgress?: (ratio: number) => void } = {},
) =>
  run(
    serverEnv.ffmpegPath,
    ["-hide_banner", "-nostdin", "-y", "-loglevel", "error", "-progress", "pipe:1", "-nostats", ...args],
    {
      cwd: options.cwd,
      signal: options.signal,
      onStdoutLine: (line) => {
        if (!options.onProgress || !options.duration) return;
        const match = /^out_time_(?:us|ms)=(\d+)/.exec(line);
        if (match) options.onProgress(Math.min(1, Number(match[1]) / 1e6 / options.duration));
      },
    },
  );

/**
 * Trích 1 khung hình đại diện quanh thời điểm `time`.
 * Bộ lọc `thumbnail` chọn khung tiêu biểu nhất trong N khung kế tiếp nên tránh được khung đen/chuyển cảnh.
 */
export const extractFrame = (input: string, time: number, output: string, width = 1920, pick = 30) =>
  ffmpeg([
    "-ss", time.toFixed(2),
    "-i", input,
    "-vf", `${pick > 1 ? `thumbnail=${pick},` : ""}scale='min(${width},iw)':-2`,
    "-frames:v", "1",
    "-q:v", "2",
    output,
  ]);

/** Tham số tốc độ phù hợp cho từng bộ mã hoá H.264. */
export const encoderArgs = (encoder: string): string[] => {
  switch (encoder) {
    case "h264_nvenc":
      return ["-c:v", "h264_nvenc", "-preset", "p4", "-rc", "vbr"];
    case "h264_qsv":
      return ["-c:v", "h264_qsv", "-preset", "veryfast"];
    case "h264_amf":
      return ["-c:v", "h264_amf", "-quality", "speed"];
    default:
      return ["-c:v", "libx264", "-preset", "veryfast", "-profile:v", "high"];
  }
};
