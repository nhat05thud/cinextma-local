import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { PUBLIC_DIR, publicPath, removeQuietly, toPublicRelative } from "../storage";

export type ImageKind = "poster" | "backdrop" | "logo" | "still" | "profile" | "season";

const PRESETS: Record<ImageKind, { width: number; height?: number; fit: "cover" | "inside" }> = {
  poster: { width: 600, height: 900, fit: "cover" },
  season: { width: 600, height: 900, fit: "cover" },
  backdrop: { width: 1920, height: 1080, fit: "cover" },
  still: { width: 640, height: 360, fit: "cover" },
  profile: { width: 300, height: 450, fit: "cover" },
  logo: { width: 800, fit: "inside" },
};

/**
 * Chuẩn hoá ảnh (resize + webp) rồi lưu vào public/images/<kind>/.
 * Trả về đường dẫn tương đối để lưu DB.
 */
export const saveImage = async (
  input: Buffer | string,
  kind: ImageKind,
  options: { smartCrop?: boolean } = {},
): Promise<string> => {
  const preset = PRESETS[kind];
  const dir = path.join(PUBLIC_DIR, "images", kind);
  await fs.promises.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${randomUUID()}.webp`);

  await sharp(input, { failOn: "none" })
    .rotate()
    .resize({
      width: preset.width,
      height: preset.height,
      fit: preset.fit,
      // Cắt thông minh vào vùng nổi bật (khuôn mặt, chi tiết) khi tạo poster dọc từ khung hình ngang.
      position: options.smartCrop ? sharp.strategy.attention : "centre",
      withoutEnlargement: kind === "logo",
    })
    .webp({ quality: kind === "logo" ? 90 : 82, alphaQuality: 100 })
    .toFile(file);

  return toPublicRelative(file);
};

/** Ảnh bìa tạo từ khung hình video: poster dọc 2:3, backdrop ngang 16:9, ảnh tập 16:9. */
export const coverFromFrame = (frameRelative: string, kind: "poster" | "backdrop" | "still" | "season") =>
  saveImage(publicPath(frameRelative), kind, { smartCrop: kind === "poster" || kind === "season" });

export const downloadImage = async (url: string, kind: ImageKind, options: { smartCrop?: boolean } = {}) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Không tải được ảnh: ${url} (${response.status})`);
  return saveImage(Buffer.from(await response.arrayBuffer()), kind, options);
};

/** Xoá file ảnh cũ khi được thay thế (chỉ xoá ảnh do hệ thống quản lý trong images/). */
export const deleteImage = async (relative: string | null | undefined) => {
  if (!relative || !relative.startsWith("images/")) return;
  await removeQuietly(publicPath(relative));
};

/**
 * Chấm điểm khung hình để chọn ảnh bìa mặc định: ưu tiên ảnh nhiều chi tiết (entropy cao),
 * phạt ảnh quá tối hoặc quá sáng.
 */
export const scoreFrame = async (file: string) => {
  const stats = await sharp(file).stats();
  const mean = stats.channels.slice(0, 3).reduce((sum, c) => sum + c.mean, 0) / 3;
  const exposurePenalty = mean < 35 ? (35 - mean) / 10 : mean > 225 ? (mean - 225) / 10 : 0;
  return stats.entropy + stats.sharpness / 10 - exposurePenalty;
};
