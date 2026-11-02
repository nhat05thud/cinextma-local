"use server";

import { prisma } from "@/server/db";
import { adminAction, fileFromForm, revalidateSite } from "@/server/admin/common";
import { coverFromFrame, deleteImage, saveImage } from "@/server/media/images";
import { deleteVideoCompletely } from "@/server/media/cleanup";

export async function createSeason(titleId: string) {
  return adminAction(async () => {
    const last = await prisma.season.findFirst({ where: { titleId }, orderBy: { number: "desc" } });
    const number = (last?.number ?? 0) + 1;
    await prisma.season.create({ data: { titleId, number, name: `Phần ${number}` } });
    revalidateSite();
    return { success: true, message: `Đã thêm Phần ${number}` };
  });
}

export async function updateSeason(id: string, input: { name?: string | null; overview?: string | null; number?: number }) {
  return adminAction(async () => {
    await prisma.season.update({
      where: { id },
      data: { name: input.name?.trim() || null, overview: input.overview?.trim() || null, ...(input.number ? { number: input.number } : {}) },
    });
    revalidateSite();
    return { success: true, message: "Đã lưu phần phim" };
  });
}

export async function deleteSeason(id: string, deleteVideos: boolean) {
  return adminAction(async () => {
    const season = await prisma.season.findUniqueOrThrow({ where: { id }, include: { episodes: true } });
    await prisma.season.delete({ where: { id } });
    await deleteImage(season.posterPath);
    for (const e of season.episodes) {
      await deleteImage(e.stillPath);
      if (deleteVideos && e.videoId) await deleteVideoCompletely(e.videoId);
    }
    revalidateSite();
    return { success: true, message: "Đã xoá phần phim" };
  });
}

/** Thêm N tập trống tiếp theo vào một phần. */
export async function addEpisodes(seasonId: string, count: number) {
  return adminAction(async () => {
    const last = await prisma.episode.findFirst({ where: { seasonId }, orderBy: { number: "desc" } });
    const start = (last?.number ?? 0) + 1;
    const n = Math.min(Math.max(1, count), 200);
    await prisma.episode.createMany({ data: Array.from({ length: n }, (_, i) => ({ seasonId, number: start + i })) });
    revalidateSite();
    return { success: true, message: `Đã thêm ${n} tập` };
  });
}

/**
 * Đảm bảo các tập (phần, số tập) tồn tại — dùng khi upload nhiều file một lúc.
 * Trả về id của từng tập theo đúng thứ tự đầu vào.
 */
export async function ensureEpisodes(titleId: string, items: { season: number; episode: number }[]) {
  return adminAction(async () => {
    const ids: string[] = [];
    for (const item of items) {
      const season = await prisma.season.upsert({
        where: { titleId_number: { titleId, number: item.season } },
        update: {},
        create: { titleId, number: item.season, name: `Phần ${item.season}` },
      });
      const episode = await prisma.episode.upsert({
        where: { seasonId_number: { seasonId: season.id, number: item.episode } },
        update: {},
        create: { seasonId: season.id, number: item.episode },
      });
      ids.push(episode.id);
    }
    return { success: true, data: ids };
  });
}

export async function updateEpisode(
  id: string,
  input: { number: number; name?: string | null; overview?: string | null; runtime?: number | null; airDate?: string | null },
) {
  return adminAction(async () => {
    const date = input.airDate ? new Date(input.airDate) : null;
    await prisma.episode.update({
      where: { id },
      data: {
        number: input.number,
        name: input.name?.trim() || null,
        overview: input.overview?.trim() || null,
        runtime: input.runtime || null,
        airDate: date && !Number.isNaN(date.getTime()) ? date : null,
      },
    });
    revalidateSite();
    return { success: true, message: "Đã lưu tập phim" };
  });
}

export async function deleteEpisode(id: string, deleteVideo: boolean) {
  return adminAction(async () => {
    const episode = await prisma.episode.delete({ where: { id } });
    await deleteImage(episode.stillPath);
    if (deleteVideo && episode.videoId) await deleteVideoCompletely(episode.videoId);
    revalidateSite();
    return { success: true, message: "Đã xoá tập phim" };
  });
}

export async function uploadEpisodeStill(id: string, form: FormData) {
  return adminAction(async () => {
    const { buffer } = await fileFromForm(form);
    const episode = await prisma.episode.findUniqueOrThrow({ where: { id } });
    await prisma.episode.update({ where: { id }, data: { stillPath: await saveImage(buffer, "still") } });
    await deleteImage(episode.stillPath);
    revalidateSite();
    return { success: true, message: "Đã cập nhật ảnh tập" };
  });
}

export async function setEpisodeStillFromFrame(id: string, framePath: string) {
  return adminAction(async () => {
    if (!framePath.startsWith("videos/") || framePath.includes("..")) throw new Error("Khung hình không hợp lệ");
    const episode = await prisma.episode.findUniqueOrThrow({ where: { id } });
    await prisma.episode.update({ where: { id }, data: { stillPath: await coverFromFrame(framePath, "still") } });
    await deleteImage(episode.stillPath);
    revalidateSite();
    return { success: true, message: "Đã tạo ảnh tập từ khung hình" };
  });
}
