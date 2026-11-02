"use server";

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "@/server/db";
import { adminAction, fileFromForm, revalidateSite } from "@/server/admin/common";
import { attachVideo } from "@/server/media/attach";
import { applyAutoCovers } from "@/server/media/covers";
import { deleteVideoCompletely } from "@/server/media/cleanup";
import { extractFrame } from "@/server/media/ffmpeg";
import { parseFrames } from "@/server/media/frames";
import { frameSourceFor, videoBaseDir } from "@/server/media/pipeline";
import { convertSubtitleFile, resolveLanguage } from "@/server/media/subtitles";
import { scoreFrame } from "@/server/media/images";
import { publicPath, removeQuietly } from "@/server/storage";
import { wakeWorker } from "@/server/media/worker";
import { ACTIVE_VIDEO_STATUSES } from "@/types/media";

export async function reprocessVideo(id: string, mode: "auto" | "copy" | "transcode") {
  return adminAction(async () => {
    const video = await prisma.video.findUniqueOrThrow({ where: { id } });
    // Video lấy từ link mà chưa tải xong / không còn file gốc -> tải lại từ nguồn
    const redownload = !video.sourcePath && !!video.sourceUrl;
    if (!video.sourcePath && !redownload) throw new Error("Không còn file gốc (KEEP_ORIGINALS=false). Hãy upload lại video.");
    await prisma.video.update({
      where: { id },
      data: { status: redownload ? "download_queued" : "queued", mode, progress: 0, stage: null, error: null },
    });
    wakeWorker();
    revalidateSite();
    return { success: true, message: redownload ? "Đã đưa video vào hàng đợi tải lại từ nguồn" : "Đã đưa video vào hàng đợi xử lý" };
  });
}

/** Huỷ xử lý: worker phát hiện trạng thái đổi và dừng ffmpeg. */
export async function cancelVideo(id: string) {
  return adminAction(async () => {
    await prisma.video.updateMany({
      where: { id, status: { in: ACTIVE_VIDEO_STATUSES } },
      data: { status: "failed", error: "Đã huỷ bởi admin", progress: 0 },
    });
    return { success: true, message: "Đã huỷ xử lý" };
  });
}

export async function deleteVideo(id: string) {
  return adminAction(async () => {
    await deleteVideoCompletely(id);
    revalidateSite();
    return { success: true, message: "Đã xoá video" };
  });
}

export async function attachVideoAction(videoId: string, targetType: "title" | "episode", targetId: string) {
  return adminAction(async () => {
    await attachVideo(videoId, targetType, targetId);
    revalidateSite();
    return { success: true, message: "Đã gắn video" };
  });
}

export async function detachVideo(videoId: string) {
  return adminAction(async () => {
    await prisma.title.updateMany({ where: { videoId }, data: { videoId: null } });
    await prisma.episode.updateMany({ where: { videoId }, data: { videoId: null } });
    revalidateSite();
    return { success: true, message: "Đã gỡ video khỏi phim (video vẫn còn trong thư viện)" };
  });
}

/** Bật/tắt tự tạo ảnh bìa; bật lại thì tạo ngay cho các ô ảnh còn trống. */
export async function setAutoCover(id: string, autoCover: boolean) {
  return adminAction(async () => {
    await prisma.video.update({ where: { id }, data: { autoCover } });
    if (autoCover) await applyAutoCovers(id);
    revalidateSite();
    return { success: true, message: autoCover ? "Đã bật tự tạo ảnh bìa" : "Đã tắt tự tạo ảnh bìa" };
  });
}

/** Chụp khung hình tại thời điểm bất kỳ (giây) để làm ảnh bìa. */
export async function captureFrame(id: string, time: number) {
  return adminAction(async () => {
    const video = await prisma.video.findUniqueOrThrow({ where: { id } });
    const source = frameSourceFor(video);
    if (!source) throw new Error("Không tìm thấy nguồn video để chụp khung hình");
    const t = Math.max(0, Math.min(time, (video.duration ?? time) - 0.5));
    const relative = `${videoBaseDir(id)}/frames/c_${Math.round(t * 10)}_${randomUUID().slice(0, 6)}.jpg`;
    await fs.promises.mkdir(path.dirname(publicPath(relative)), { recursive: true });
    await extractFrame(source, t, publicPath(relative), 1920, 1);
    const frames = parseFrames(video.frames);
    frames.push({ path: relative, time: Math.round(t), score: await scoreFrame(publicPath(relative)), custom: true });
    await prisma.video.update({ where: { id }, data: { frames: JSON.stringify(frames) } });
    return { success: true, message: "Đã chụp khung hình", data: { path: relative } };
  });
}

export async function deleteFrame(id: string, framePath: string) {
  return adminAction(async () => {
    const video = await prisma.video.findUniqueOrThrow({ where: { id } });
    const frames = parseFrames(video.frames).filter((f) => f.path !== framePath);
    await prisma.video.update({ where: { id }, data: { frames: JSON.stringify(frames) } });
    if (framePath.startsWith(`${videoBaseDir(id)}/frames/`)) await removeQuietly(publicPath(framePath));
    return { success: true };
  });
}

// ---------------------------------------------------------------------------
// Phụ đề
// ---------------------------------------------------------------------------

export async function uploadSubtitle(videoId: string, form: FormData) {
  return adminAction(async () => {
    const { file, buffer } = await fileFromForm(form, "file", 10);
    const ext = path.extname(file.name).toLowerCase();
    if (![".srt", ".vtt", ".ass", ".ssa"].includes(ext)) throw new Error("Chỉ hỗ trợ phụ đề .srt, .vtt, .ass, .ssa");
    const lang = resolveLanguage(String(form.get("lang") || "vi"));
    const label = String(form.get("label") || "").trim() || lang.label;
    const relative = `${videoBaseDir(videoId)}/subs/${lang.code}-${randomUUID().slice(0, 8)}.vtt`;
    await convertSubtitleFile(buffer, ext, publicPath(relative));
    const hasDefault = await prisma.subtitle.count({ where: { videoId, isDefault: true } });
    await prisma.subtitle.create({
      data: { videoId, lang: lang.code, label, path: relative, isDefault: !hasDefault && lang.code === "vi" },
    });
    revalidateSite();
    return { success: true, message: `Đã thêm phụ đề ${label}` };
  });
}

export async function setDefaultSubtitle(id: string) {
  return adminAction(async () => {
    const subtitle = await prisma.subtitle.findUniqueOrThrow({ where: { id } });
    await prisma.$transaction([
      prisma.subtitle.updateMany({ where: { videoId: subtitle.videoId }, data: { isDefault: false } }),
      prisma.subtitle.update({ where: { id }, data: { isDefault: !subtitle.isDefault } }),
    ]);
    revalidateSite();
    return { success: true, message: subtitle.isDefault ? "Đã tắt phụ đề mặc định" : "Đã đặt làm phụ đề mặc định" };
  });
}

export async function deleteSubtitle(id: string) {
  return adminAction(async () => {
    const subtitle = await prisma.subtitle.delete({ where: { id } });
    await removeQuietly(publicPath(subtitle.path));
    revalidateSite();
    return { success: true, message: "Đã xoá phụ đề" };
  });
}

/** Trạng thái xử lý của nhiều video — client poll để cập nhật thanh tiến độ. */
export async function getVideoStatuses(ids: string[]) {
  return adminAction(async () =>
    prisma.video.findMany({
      where: { id: { in: ids.slice(0, 200) } },
      select: { id: true, status: true, progress: true, stage: true, error: true },
    }),
  );
}
