"use server";

import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/server/db";
import { adminAction, revalidateSite } from "@/server/admin/common";
import { requireAdmin } from "@/server/session";
import { slugify } from "@/lib/catalog";
import { DEFAULT_SETTINGS } from "@/lib/settings";

// ---------------------------------------------------------------------------
// Thể loại
// ---------------------------------------------------------------------------

export async function saveGenre(input: { id?: string; name: string }) {
  return adminAction(async () => {
    const name = input.name.trim();
    if (!name) throw new Error("Vui lòng nhập tên thể loại");
    const slug = slugify(name);
    if (input.id) await prisma.genre.update({ where: { id: input.id }, data: { name, slug } });
    else {
      const last = await prisma.genre.findFirst({ orderBy: { position: "desc" } });
      await prisma.genre.create({ data: { name, slug, position: (last?.position ?? 0) + 1 } });
    }
    revalidateSite();
    return { success: true, message: "Đã lưu thể loại" };
  });
}

export async function deleteGenre(id: string) {
  return adminAction(async () => {
    await prisma.genre.delete({ where: { id } });
    revalidateSite();
    return { success: true, message: "Đã xoá thể loại" };
  });
}

export async function moveGenre(id: string, direction: -1 | 1) {
  return adminAction(async () => {
    const all = await prisma.genre.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] });
    const index = all.findIndex((g) => g.id === id);
    if (index < 0 || !all[index + direction]) return { success: true };
    [all[index], all[index + direction]] = [all[index + direction], all[index]];
    await prisma.$transaction(all.map((g, i) => prisma.genre.update({ where: { id: g.id }, data: { position: i } })));
    revalidateSite();
    return { success: true };
  });
}

// ---------------------------------------------------------------------------
// Bộ sưu tập (hàng phim tuỳ chỉnh trên trang chủ)
// ---------------------------------------------------------------------------

export async function saveCollection(input: { id?: string; name: string; active?: boolean }) {
  return adminAction(async () => {
    const name = input.name.trim();
    if (!name) throw new Error("Vui lòng nhập tên");
    if (input.id) {
      await prisma.collection.update({ where: { id: input.id }, data: { name, active: input.active } });
      revalidateSite();
      return { success: true, message: "Đã lưu" };
    }
    let slug = slugify(name) || "bo-suu-tap";
    for (let i = 2; await prisma.collection.findUnique({ where: { slug } }); i++) slug = `${slugify(name)}-${i}`;
    const last = await prisma.collection.findFirst({ orderBy: { position: "desc" } });
    const created = await prisma.collection.create({ data: { name, slug, position: (last?.position ?? 0) + 1 } });
    revalidateSite();
    return { success: true, message: "Đã tạo bộ sưu tập", data: { id: created.id } };
  });
}

export async function deleteCollection(id: string) {
  return adminAction(async () => {
    await prisma.collection.delete({ where: { id } });
    revalidateSite();
    return { success: true, message: "Đã xoá bộ sưu tập" };
  });
}

export async function moveCollection(id: string, direction: -1 | 1) {
  return adminAction(async () => {
    const all = await prisma.collection.findMany({ orderBy: { position: "asc" } });
    const index = all.findIndex((c) => c.id === id);
    if (index < 0 || !all[index + direction]) return { success: true };
    [all[index], all[index + direction]] = [all[index + direction], all[index]];
    await prisma.$transaction(all.map((c, i) => prisma.collection.update({ where: { id: c.id }, data: { position: i } })));
    revalidateSite();
    return { success: true };
  });
}

export async function setCollectionItems(id: string, titleIds: string[]) {
  return adminAction(async () => {
    await prisma.$transaction([
      prisma.collectionItem.deleteMany({ where: { collectionId: id } }),
      prisma.collectionItem.createMany({
        data: [...new Set(titleIds)].map((titleId, position) => ({ collectionId: id, titleId, position })),
      }),
    ]);
    revalidateSite();
    return { success: true, message: "Đã lưu danh sách phim" };
  });
}

export async function searchTitlesForPicker(query: string) {
  return adminAction(async () =>
    prisma.title.findMany({
      where: query.trim() ? { searchText: { contains: slugify(query) } } : {},
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { id: true, title: true, type: true, year: true, posterPath: true, status: true },
    }),
  );
}

// ---------------------------------------------------------------------------
// Người dùng
// ---------------------------------------------------------------------------

const notSelf = async (userId: string) => {
  const session = await requireAdmin();
  if (session.user.id === userId) throw new Error("Không thể thực hiện thao tác này với chính tài khoản của bạn");
};

export async function setUserRole(userId: string, role: "admin" | "user") {
  return adminAction(async () => {
    await notSelf(userId);
    await prisma.user.update({ where: { id: userId }, data: { role } });
    return { success: true, message: role === "admin" ? "Đã cấp quyền admin" : "Đã bỏ quyền admin" };
  });
}

export async function setUserBanned(userId: string, banned: boolean) {
  return adminAction(async () => {
    await notSelf(userId);
    await prisma.user.update({ where: { id: userId }, data: { banned, banReason: banned ? "Khoá bởi admin" : null } });
    if (banned) await prisma.session.deleteMany({ where: { userId } });
    return { success: true, message: banned ? "Đã khoá tài khoản" : "Đã mở khoá tài khoản" };
  });
}

export async function resetUserPassword(userId: string, password: string) {
  return adminAction(async () => {
    if (password.length < 8) throw new Error("Mật khẩu phải có ít nhất 8 ký tự");
    const hash = await hashPassword(password);
    const account = await prisma.account.findFirst({ where: { userId, providerId: "credential" } });
    if (account) await prisma.account.update({ where: { id: account.id }, data: { password: hash } });
    else
      await prisma.account.create({
        data: { id: crypto.randomUUID(), accountId: userId, providerId: "credential", userId, password: hash },
      });
    await prisma.session.deleteMany({ where: { userId } });
    return { success: true, message: "Đã đặt lại mật khẩu" };
  });
}

export async function createUser(input: { name: string; email: string; password: string; role: "admin" | "user" }) {
  return adminAction(async () => {
    const email = input.email.trim().toLowerCase();
    if (!email.includes("@")) throw new Error("Email không hợp lệ");
    if (input.password.length < 8) throw new Error("Mật khẩu phải có ít nhất 8 ký tự");
    if (await prisma.user.findUnique({ where: { email } })) throw new Error("Email đã tồn tại");
    const id = crypto.randomUUID();
    await prisma.user.create({
      data: {
        id,
        email,
        name: input.name.trim() || email.split("@")[0],
        emailVerified: true,
        role: input.role,
        accounts: {
          create: { id: crypto.randomUUID(), accountId: id, providerId: "credential", password: await hashPassword(input.password) },
        },
      },
    });
    return { success: true, message: "Đã tạo tài khoản" };
  });
}

export async function deleteUser(userId: string) {
  return adminAction(async () => {
    await notSelf(userId);
    await prisma.user.delete({ where: { id: userId } });
    return { success: true, message: "Đã xoá tài khoản" };
  });
}

// ---------------------------------------------------------------------------
// Cài đặt
// ---------------------------------------------------------------------------

export async function saveSettings(input: Record<string, string>) {
  return adminAction(async () => {
    const allowed = [...Object.keys(DEFAULT_SETTINGS), "tmdbToken"];
    for (const [key, value] of Object.entries(input)) {
      if (!allowed.includes(key)) continue;
      await prisma.setting.upsert({ where: { key }, update: { value: value.trim() }, create: { key, value: value.trim() } });
    }
    revalidateSite();
    return { success: true, message: "Đã lưu cài đặt" };
  });
}

export async function getTitleEpisodes(titleId: string) {
  return adminAction(async () => {
    const seasons = await prisma.season.findMany({
      where: { titleId },
      orderBy: { number: "asc" },
      include: { episodes: { orderBy: { number: "asc" }, select: { id: true, number: true, name: true, videoId: true } } },
    });
    return seasons.flatMap((s) =>
      s.episodes.map((e) => ({
        id: e.id,
        label: `Phần ${s.number} • Tập ${e.number}${e.name ? `: ${e.name}` : ""}${e.videoId ? " (đã có video)" : ""}`,
      })),
    );
  });
}
