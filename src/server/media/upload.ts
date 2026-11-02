import fs from "node:fs";
import path from "node:path";
import { Server } from "@tus/server";
import { FileStore } from "@tus/file-store";
import { prisma } from "../db";
import { isAdminRequest } from "../session";
import { ORIGINALS_DIR, UPLOAD_TMP_DIR, ensureStorageDirs } from "../storage";
import { attachVideo } from "./attach";
import { wakeWorker } from "./worker";

export const UPLOAD_ENDPOINT = "/api/admin/upload";

export const VIDEO_EXTENSIONS = [".mp4", ".mkv", ".mov", ".avi", ".webm", ".m4v", ".ts", ".wmv", ".flv", ".mpg", ".mpeg"];

const reject = (status_code: number, body: string) => ({ status_code, body });

const createServer = () => {
  ensureStorageDirs();
  return new Server({
    path: UPLOAD_ENDPOINT,
    datastore: new FileStore({ directory: UPLOAD_TMP_DIR, expirationPeriodInMilliseconds: 3 * 24 * 3600 * 1000 }),
    relativeLocation: true,
    respectForwardedHeaders: true,
    maxSize: 200 * 1024 ** 3,

    async onIncomingRequest(req) {
      if (!(await isAdminRequest(req.headers))) throw reject(403, "Bạn không có quyền upload");
    },

    async onUploadCreate(_req, upload) {
      const name = upload.metadata?.filename ?? "";
      if (!VIDEO_EXTENSIONS.includes(path.extname(name).toLowerCase())) {
        throw reject(400, `Định dạng không hỗ trợ: ${name}`);
      }
      return { metadata: upload.metadata };
    },

    async onUploadFinish(_req, upload) {
      const meta = upload.metadata ?? {};
      const originalName = meta.filename ?? "video";
      const video = await prisma.video.create({
        data: {
          originalName,
          size: BigInt(upload.size ?? upload.offset),
          mimeType: meta.filetype || null,
          mode: ["auto", "copy", "transcode"].includes(meta.mode ?? "") ? meta.mode! : "auto",
          autoCover: meta.autoCover !== "false",
          status: "queued",
        },
      });

      // Chuyển file từ thư mục tạm sang originals/<videoId>/source.<ext>
      const ext = path.extname(originalName).toLowerCase() || ".mp4";
      const dir = path.join(ORIGINALS_DIR, video.id);
      await fs.promises.mkdir(dir, { recursive: true });
      const tmp = path.join(UPLOAD_TMP_DIR, upload.id);
      const target = path.join(dir, `source${ext}`);
      try {
        await fs.promises.rename(tmp, target);
      } catch {
        // khác ổ đĩa: copy rồi xoá
        await fs.promises.copyFile(tmp, target);
        await fs.promises.rm(tmp, { force: true });
      }
      await fs.promises.rm(`${tmp}.json`, { force: true });
      await prisma.video.update({
        where: { id: video.id },
        data: { sourcePath: `originals/${video.id}/source${ext}` },
      });

      if (meta.targetType && meta.targetId) {
        await attachVideo(video.id, meta.targetType as "title" | "episode", meta.targetId);
      }
      wakeWorker();

      return { headers: { "X-Video-Id": video.id } };
    },
  });
};

const globalForTus = globalThis as unknown as { tusServer?: Server };
export const tusServer = globalForTus.tusServer ?? (globalForTus.tusServer = createServer());
