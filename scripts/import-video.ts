/**
 * Nhập file video có sẵn trên máy chủ vào thư viện media (không cần upload qua trình duyệt).
 *
 *   npm run video:import -- "D:\Phim\Avatar.mkv" [--move] [--mode=auto|copy|transcode] [--no-cover] [--now]
 *
 *   --move      Di chuyển file thay vì sao chép
 *   --mode      Chế độ xử lý (mặc định auto)
 *   --no-cover  Không tự tạo ảnh bìa từ video
 *   --now       Xử lý ngay trong script này (không chờ worker của web server)
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/server/db";
import { ORIGINALS_DIR, ensureStorageDirs } from "@/server/storage";
import { processVideo } from "@/server/media/pipeline";

const args = process.argv.slice(2);
const files = args.filter((a) => !a.startsWith("--"));
const flag = (name: string) => args.includes(`--${name}`);
const mode = args.find((a) => a.startsWith("--mode="))?.split("=")[1] ?? "auto";

async function main() {
  if (!files.length) {
    console.error('Cách dùng: npm run video:import -- "<đường dẫn file>" [--move] [--mode=auto|copy|transcode] [--no-cover] [--now]');
    process.exit(1);
  }
  ensureStorageDirs();

  for (const file of files) {
    const absolute = path.resolve(file);
    const stat = await fs.promises.stat(absolute).catch(() => null);
    if (!stat?.isFile()) {
      console.error(`✘ Không tìm thấy file: ${absolute}`);
      continue;
    }
    const ext = path.extname(absolute).toLowerCase() || ".mp4";
    const video = await prisma.video.create({
      data: {
        originalName: path.basename(absolute),
        size: BigInt(stat.size),
        mode,
        autoCover: !flag("no-cover"),
        status: flag("now") ? "processing" : "queued",
      },
    });
    const dir = path.join(ORIGINALS_DIR, video.id);
    await fs.promises.mkdir(dir, { recursive: true });
    const target = path.join(dir, `source${ext}`);
    if (flag("move")) await fs.promises.rename(absolute, target).catch(() => fs.promises.copyFile(absolute, target));
    else await fs.promises.copyFile(absolute, target);
    await prisma.video.update({ where: { id: video.id }, data: { sourcePath: `originals/${video.id}/source${ext}` } });
    console.log(`✔ Đã nhập ${path.basename(absolute)} -> video ${video.id}`);

    if (flag("now")) {
      const started = Date.now();
      try {
        await processVideo(video.id);
        console.log(`  ✔ Xử lý xong sau ${((Date.now() - started) / 1000).toFixed(1)}s`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await prisma.video.update({ where: { id: video.id }, data: { status: "failed", error: message } });
        console.error(`  ✘ Lỗi: ${message}`);
      }
    }
  }
}

main().finally(() => prisma.$disconnect());
