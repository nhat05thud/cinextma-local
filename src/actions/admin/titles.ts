"use server";

import { z } from "zod";
import { prisma } from "@/server/db";
import { adminAction, fileFromForm, refreshSearchText, revalidateSite, uniqueTitleSlug } from "@/server/admin/common";
import { applyTmdb, searchTmdb, type TmdbSearchItem } from "@/server/admin/tmdb";
import { coverFromFrame, deleteImage, saveImage, type ImageKind } from "@/server/media/images";
import { deleteVideoCompletely } from "@/server/media/cleanup";

const optionalText = z
  .string()
  .trim()
  .transform((v) => v || null)
  .nullable()
  .optional();
const optionalInt = z.coerce.number().int().min(0).nullable().optional().catch(null);

const titleSchema = z.object({
  title: z.string().trim().min(1, "Vui lòng nhập tên phim"),
  slug: z.string().trim().optional(),
  originalTitle: optionalText,
  tagline: optionalText,
  overview: optionalText,
  releaseDate: optionalText,
  year: optionalInt,
  runtime: optionalInt,
  ageRating: optionalText,
  quality: optionalText,
  country: optionalText,
  language: optionalText,
  rating: z.coerce.number().min(0).max(10).catch(0),
  voteCount: z.coerce.number().int().min(0).catch(0),
  trailerUrl: optionalText,
  imdbId: optionalText,
  seriesStatus: optionalText,
  totalEpisodes: optionalInt,
  featured: z.boolean().optional(),
  genreIds: z.array(z.string()).default([]),
});

export type TitleInput = z.input<typeof titleSchema>;

/** Tạo phim mới (bản nháp) rồi chuyển tới trang chỉnh sửa. */
export async function createTitle(input: { type: "movie" | "tv"; title: string; year?: number | null }) {
  return adminAction(async () => {
    const name = input.title.trim();
    if (!name) throw new Error("Vui lòng nhập tên phim");
    const title = await prisma.title.create({
      data: {
        type: input.type,
        title: name,
        year: input.year ?? null,
        slug: await uniqueTitleSlug(name),
        status: "draft",
        ...(input.type === "tv" ? { seasons: { create: { number: 1, name: "Phần 1" } } } : {}),
      },
    });
    await refreshSearchText(title.id);
    return { id: title.id };
  });
}

export async function updateTitle(id: string, input: TitleInput) {
  return adminAction(async () => {
    const parsed = titleSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    const { genreIds, slug, releaseDate, ...data } = parsed.data;
    const date = releaseDate ? new Date(releaseDate) : null;

    await prisma.title.update({
      where: { id },
      data: {
        ...data,
        slug: await uniqueTitleSlug(slug || data.title, id),
        releaseDate: date && !Number.isNaN(date.getTime()) ? date : null,
        year: data.year ?? (date && !Number.isNaN(date.getTime()) ? date.getFullYear() : null),
        genres: { deleteMany: {}, create: genreIds.map((genreId) => ({ genreId })) },
      },
    });
    await refreshSearchText(id);
    revalidateSite();
    return { success: true, message: "Đã lưu thông tin phim" };
  });
}

export async function setTitleStatus(id: string, status: "draft" | "published") {
  return adminAction(async () => {
    const title = await prisma.title.findUniqueOrThrow({ where: { id } });
    await prisma.title.update({
      where: { id },
      data: { status, publishedAt: status === "published" ? (title.publishedAt ?? new Date()) : title.publishedAt },
    });
    revalidateSite();
    return { success: true, message: status === "published" ? "Đã xuất bản phim" : "Đã chuyển về bản nháp" };
  });
}

export async function toggleFeatured(id: string, featured: boolean) {
  return adminAction(async () => {
    await prisma.title.update({ where: { id }, data: { featured } });
    revalidateSite();
    return { success: true, message: featured ? "Đã đưa lên banner trang chủ" : "Đã bỏ khỏi banner" };
  });
}

/** Đẩy phim lên đầu danh sách "Mới cập nhật" (ví dụ khi có tập mới). */
export async function bumpTitle(id: string) {
  return adminAction(async () => {
    await prisma.title.update({ where: { id }, data: { publishedAt: new Date() } });
    revalidateSite();
    return { success: true, message: "Đã đưa phim lên đầu mục Mới cập nhật" };
  });
}

export async function deleteTitle(id: string, deleteVideos: boolean) {
  return adminAction(async () => {
    const title = await prisma.title.findUniqueOrThrow({
      where: { id },
      include: { seasons: { include: { episodes: true } } },
    });
    const videoIds = [title.videoId, ...title.seasons.flatMap((s) => s.episodes.map((e) => e.videoId))].filter(Boolean) as string[];
    const images = [title.posterPath, title.backdropPath, title.logoPath, ...title.seasons.flatMap((s) => [s.posterPath, ...s.episodes.map((e) => e.stillPath)])];

    await prisma.title.delete({ where: { id } });
    await Promise.all(images.map(deleteImage));
    if (deleteVideos) for (const videoId of videoIds) await deleteVideoCompletely(videoId);
    revalidateSite();
    return { success: true, message: "Đã xoá phim" };
  });
}

// ---------------------------------------------------------------------------
// Ảnh bìa: upload hoặc lấy từ khung hình video
// ---------------------------------------------------------------------------

const IMAGE_FIELDS = { poster: "posterPath", backdrop: "backdropPath", logo: "logoPath" } as const;
type TitleImageKind = keyof typeof IMAGE_FIELDS;

export async function uploadTitleImage(id: string, kind: TitleImageKind, form: FormData) {
  return adminAction(async () => {
    const { buffer } = await fileFromForm(form);
    const field = IMAGE_FIELDS[kind];
    const title = await prisma.title.findUniqueOrThrow({ where: { id } });
    const path = await saveImage(buffer, kind as ImageKind);
    await prisma.title.update({ where: { id }, data: { [field]: path } });
    await deleteImage(title[field]);
    revalidateSite();
    return { success: true, message: "Đã cập nhật ảnh", data: { path } };
  });
}

export async function setTitleImageFromFrame(id: string, kind: "poster" | "backdrop", framePath: string) {
  return adminAction(async () => {
    if (!framePath.startsWith("videos/") || framePath.includes("..")) throw new Error("Khung hình không hợp lệ");
    const field = IMAGE_FIELDS[kind];
    const title = await prisma.title.findUniqueOrThrow({ where: { id } });
    const path = await coverFromFrame(framePath, kind);
    await prisma.title.update({ where: { id }, data: { [field]: path } });
    await deleteImage(title[field]);
    revalidateSite();
    return { success: true, message: kind === "poster" ? "Đã tạo poster từ khung hình" : "Đã tạo ảnh nền từ khung hình", data: { path } };
  });
}

export async function removeTitleImage(id: string, kind: TitleImageKind) {
  return adminAction(async () => {
    const field = IMAGE_FIELDS[kind];
    const title = await prisma.title.findUniqueOrThrow({ where: { id } });
    await prisma.title.update({ where: { id }, data: { [field]: null } });
    await deleteImage(title[field]);
    revalidateSite();
    return { success: true, message: "Đã xoá ảnh" };
  });
}

// ---------------------------------------------------------------------------
// TMDB
// ---------------------------------------------------------------------------

export async function searchTmdbAction(query: string, type: "movie" | "tv") {
  return adminAction<TmdbSearchItem[]>(async () => {
    if (!query.trim()) return [];
    return searchTmdb(query.trim(), type);
  });
}

export async function importFromTmdb(tmdbId: number, type: "movie" | "tv") {
  return adminAction(async () => {
    const id = await applyTmdb({ tmdbId, type });
    return { success: true, message: "Đã import phim từ TMDB", data: { id } };
  });
}

export async function updateFromTmdb(titleId: string, tmdbId: number, replaceImages: boolean) {
  return adminAction(async () => {
    const title = await prisma.title.findUniqueOrThrow({ where: { id: titleId } });
    await applyTmdb({ tmdbId, type: title.type as "movie" | "tv", titleId, replaceImages });
    revalidateSite();
    return { success: true, message: "Đã cập nhật thông tin từ TMDB" };
  });
}

// ---------------------------------------------------------------------------
// Diễn viên & đoàn phim
// ---------------------------------------------------------------------------

export async function searchPeople(query: string) {
  return adminAction(async () =>
    prisma.person.findMany({
      where: { name: { contains: query.trim() } },
      take: 10,
      orderBy: { name: "asc" },
      select: { id: true, name: true, profilePath: true },
    }),
  );
}

export async function addCredit(
  titleId: string,
  input: { personId?: string; name?: string; kind: string; character?: string },
  form?: FormData,
) {
  return adminAction(async () => {
    let personId = input.personId;
    if (!personId) {
      const name = input.name?.trim();
      if (!name) throw new Error("Vui lòng nhập tên");
      const photo = form?.get("file");
      const profilePath =
        photo instanceof File && photo.size > 0 ? await saveImage(Buffer.from(await photo.arrayBuffer()), "profile") : null;
      personId = (await prisma.person.create({ data: { name, profilePath } })).id;
    }
    const count = await prisma.credit.count({ where: { titleId, kind: input.kind } });
    await prisma.credit.create({
      data: { titleId, personId, kind: input.kind, character: input.character?.trim() || null, order: count },
    });
    await refreshSearchText(titleId);
    revalidateSite();
    return { success: true, message: "Đã thêm" };
  });
}

export async function removeCredit(creditId: string) {
  return adminAction(async () => {
    const credit = await prisma.credit.delete({ where: { id: creditId } });
    await refreshSearchText(credit.titleId);
    revalidateSite();
    return { success: true, message: "Đã xoá" };
  });
}

export async function moveCredit(creditId: string, direction: -1 | 1) {
  return adminAction(async () => {
    const credit = await prisma.credit.findUniqueOrThrow({ where: { id: creditId } });
    const siblings = await prisma.credit.findMany({ where: { titleId: credit.titleId, kind: credit.kind }, orderBy: { order: "asc" } });
    const index = siblings.findIndex((c) => c.id === creditId);
    const target = siblings[index + direction];
    if (!target) return { success: true };
    const reordered = [...siblings];
    [reordered[index], reordered[index + direction]] = [target, credit];
    await prisma.$transaction(reordered.map((c, i) => prisma.credit.update({ where: { id: c.id }, data: { order: i } })));
    revalidateSite();
    return { success: true };
  });
}

export async function updatePersonPhoto(personId: string, form: FormData) {
  return adminAction(async () => {
    const { buffer } = await fileFromForm(form);
    const person = await prisma.person.findUniqueOrThrow({ where: { id: personId } });
    const profilePath = await saveImage(buffer, "profile");
    await prisma.person.update({ where: { id: personId }, data: { profilePath } });
    await deleteImage(person.profilePath);
    revalidateSite();
    return { success: true, message: "Đã cập nhật ảnh" };
  });
}
