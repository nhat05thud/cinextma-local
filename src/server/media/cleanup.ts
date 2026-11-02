import path from "node:path";
import { prisma } from "../db";
import { ORIGINALS_DIR, publicPath, removeQuietly } from "../storage";
import { videoBaseDir } from "./pipeline";

/**
 * Xoá video khỏi DB và toàn bộ file liên quan (HLS, khung hình, phụ đề, file gốc).
 * Nếu worker đang xử lý video này, nó sẽ tự dừng khi phát hiện bản ghi đã mất.
 */
export async function deleteVideoCompletely(videoId: string) {
  await prisma.video.deleteMany({ where: { id: videoId } });
  await removeQuietly(publicPath(videoBaseDir(videoId)));
  await removeQuietly(path.join(ORIGINALS_DIR, videoId));
}
