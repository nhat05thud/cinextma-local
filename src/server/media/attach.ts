import { prisma } from "../db";
import { applyAutoCovers } from "./covers";

/**
 * Gắn video vào phim lẻ hoặc tập phim. Video cũ (nếu có) vẫn còn trong thư viện media
 * để admin tự quyết định xoá.
 */
export async function attachVideo(videoId: string, targetType: "title" | "episode", targetId: string) {
  await prisma.title.updateMany({ where: { videoId }, data: { videoId: null } });
  await prisma.episode.updateMany({ where: { videoId }, data: { videoId: null } });

  if (targetType === "title") {
    const title = await prisma.title.findUnique({ where: { id: targetId }, select: { type: true } });
    if (title?.type !== "movie") throw new Error("Chỉ gắn video trực tiếp cho phim lẻ");
    await prisma.title.update({ where: { id: targetId }, data: { videoId } });
  } else {
    await prisma.episode.update({ where: { id: targetId }, data: { videoId } });
  }

  const video = await prisma.video.findUnique({ where: { id: videoId }, select: { status: true, duration: true } });
  if (video?.status !== "ready") return;
  // Video đã xử lý xong từ trước: điền thời lượng nếu còn trống + tạo ảnh bìa
  const runtime = video.duration ? Math.max(1, Math.round(video.duration / 60)) : null;
  if (runtime && targetType === "title") await prisma.title.updateMany({ where: { id: targetId, runtime: null }, data: { runtime } });
  if (runtime && targetType === "episode") await prisma.episode.updateMany({ where: { id: targetId, runtime: null }, data: { runtime } });
  await applyAutoCovers(videoId);
}
