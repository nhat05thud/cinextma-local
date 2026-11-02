import { prisma } from "../db";
import { coverFromFrame } from "./images";
import { bestFrame, parseFrames } from "./frames";

/**
 * Tự tạo ảnh bìa từ khung hình video cho những chỗ còn trống:
 * - Phim lẻ: poster (2:3, cắt thông minh) + backdrop (16:9)
 * - Tập phim: ảnh tập (16:9); nếu phim bộ chưa có poster/backdrop thì lấy luôn từ tập này
 * Chỉ chạy khi video bật `autoCover` (admin chọn "Tự tạo ảnh bìa từ video").
 */
export async function applyAutoCovers(videoId: string) {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: { title: true, episode: { include: { season: { include: { title: true } } } } },
  });
  if (!video?.autoCover) return;
  const frame = bestFrame(parseFrames(video.frames));
  if (!frame) return;

  const fillTitle = async (title: { id: string; posterPath: string | null; backdropPath: string | null }) => {
    const data: { posterPath?: string; backdropPath?: string } = {};
    if (!title.posterPath) data.posterPath = await coverFromFrame(frame.path, "poster");
    if (!title.backdropPath) data.backdropPath = await coverFromFrame(frame.path, "backdrop");
    if (Object.keys(data).length) await prisma.title.update({ where: { id: title.id }, data });
  };

  if (video.title) await fillTitle(video.title);

  if (video.episode) {
    if (!video.episode.stillPath) {
      await prisma.episode.update({
        where: { id: video.episode.id },
        data: { stillPath: await coverFromFrame(frame.path, "still") },
      });
    }
    await fillTitle(video.episode.season.title);
  }
}
