// Không import "server-only" ở đây: file này còn được dùng bởi worker chạy ngoài Next.js (tsx).
import path from "node:path";

const bool = (value: string | undefined, fallback: boolean) =>
  value === undefined || value.trim() === ""
    ? fallback
    : ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());

const list = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const serverEnv = {
  databaseUrl: process.env.DATABASE_URL || "file:./data/cinextma.db",
  mediaRoot: path.resolve(/*turbopackIgnore: true*/ process.env.MEDIA_ROOT || "./storage"),
  keepOriginals: bool(process.env.KEEP_ORIGINALS, true),
  ffmpegPath: process.env.FFMPEG_PATH || "ffmpeg",
  ffprobePath: process.env.FFPROBE_PATH || "ffprobe",
  ytdlpPath: process.env.YTDLP_PATH || "yt-dlp",
  denoPath: process.env.DENO_PATH || "",
  videoEncoder: process.env.VIDEO_ENCODER || "libx264",
  transcodeHeights: list(process.env.TRANSCODE_HEIGHTS || "1080,720,480")
    .map(Number)
    .filter((height) => height > 0)
    .sort((a, b) => b - a),
  workerEnabled: bool(process.env.WORKER_ENABLED, true),
  tmdbToken: process.env.TMDB_ACCESS_TOKEN || "",
  allowSignup: bool(process.env.ALLOW_SIGNUP, true),
  authUrl: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  trustedOrigins: list(process.env.TRUSTED_ORIGINS),
  admin: {
    email: process.env.ADMIN_EMAIL || "admin@cinextma.local",
    password: process.env.ADMIN_PASSWORD || "Admin@123456",
    name: process.env.ADMIN_NAME || "Quản trị viên",
  },
};
