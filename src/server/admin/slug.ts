// Không import "server-only": dùng được cả trong script chạy bằng tsx.
import { prisma } from "../db";
import { normalizeSearch, slugify } from "@/lib/catalog";

/** Slug duy nhất cho phim (thêm hậu tố -2, -3... nếu trùng). */
export async function uniqueTitleSlug(source: string, excludeId?: string) {
  const base = slugify(source) || "phim";
  let slug = base;
  for (let i = 2; ; i++) {
    const existing = await prisma.title.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${i}`;
  }
}

/** Cập nhật cột tìm kiếm không dấu: tên + tên gốc + diễn viên/đạo diễn. */
export async function refreshSearchText(titleId: string) {
  const title = await prisma.title.findUnique({
    where: { id: titleId },
    select: { title: true, originalTitle: true, credits: { select: { person: { select: { name: true } } } } },
  });
  if (!title) return;
  const text = [title.title, title.originalTitle, ...title.credits.map((c) => c.person.name)].filter(Boolean).join(" ");
  await prisma.title.update({ where: { id: titleId }, data: { searchText: normalizeSearch(text).slice(0, 2000) } });
}
