import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { PUBLIC_DIR, safeJoin } from "@/server/storage";

/*
 * Phục vụ file trong MEDIA_ROOT/public (HLS, ảnh, phụ đề) có hỗ trợ Range.
 * Khi chạy sau IIS, có thể để IIS phục vụ trực tiếp /media qua virtual directory cho nhanh hơn
 * (xem deploy/iis/README.md) — URL giữ nguyên nên không cần đổi code.
 */

const MIME: Record<string, string> = {
  ".m3u8": "application/vnd.apple.mpegurl",
  ".ts": "video/mp2t",
  ".m4s": "video/iso.segment",
  ".mp4": "video/mp4",
  ".vtt": "text/vtt; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

const cacheControl = (relative: string, ext: string) => {
  // Ảnh trong images/ có tên ngẫu nhiên, không bao giờ bị ghi đè
  if (relative.startsWith("images/")) return "public, max-age=31536000, immutable";
  // Playlist/phụ đề/khung hình có thể đổi khi xử lý lại video
  if ([".m3u8", ".vtt"].includes(ext) || relative.includes("/frames/")) return "no-cache";
  return "public, max-age=86400";
};

type Context = { params: Promise<{ path: string[] }> };

const handle = async (request: Request, { params }: Context, headOnly: boolean) => {
  const relative = (await params).path.map(decodeURIComponent).join("/");
  const ext = path.extname(relative).toLowerCase();
  // Chỉ phục vụ các loại file media đã biết (không bao giờ trả web.config hay file lạ)
  if (!MIME[ext]) return new Response("Not found", { status: 404 });
  const file = safeJoin(PUBLIC_DIR, relative);
  const stat = file ? await fs.promises.stat(file).catch(() => null) : null;
  if (!file || !stat?.isFile()) return new Response("Not found", { status: 404 });

  const etag = `"${stat.size.toString(36)}-${Math.floor(stat.mtimeMs).toString(36)}"`;
  const headers = new Headers({
    "Content-Type": MIME[ext],
    "Cache-Control": cacheControl(relative, ext),
    "Accept-Ranges": "bytes",
    ETag: etag,
    "Last-Modified": stat.mtime.toUTCString(),
  });

  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });

  let start = 0;
  let end = stat.size - 1;
  let status = 200;
  const range = request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (match) {
      if (match[1] === "") {
        start = Math.max(0, stat.size - Number(match[2]));
      } else {
        start = Number(match[1]);
        if (match[2] !== "") end = Math.min(end, Number(match[2]));
      }
    }
    if (!match || start > end || start >= stat.size) {
      headers.set("Content-Range", `bytes */${stat.size}`);
      return new Response(null, { status: 416, headers });
    }
    status = 206;
    headers.set("Content-Range", `bytes ${start}-${end}/${stat.size}`);
  }
  headers.set("Content-Length", String(end - start + 1));

  if (headOnly || stat.size === 0) return new Response(null, { status, headers });
  const stream = Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream;
  return new Response(stream, { status, headers });
};

export const GET = (request: Request, context: Context) => handle(request, context, false);
export const HEAD = (request: Request, context: Context) => handle(request, context, true);
