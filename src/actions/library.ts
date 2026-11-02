"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { getUser } from "@/server/session";
import type { ActionResult } from "@/types/dto";

export async function toggleWatchlist(titleId: string): Promise<ActionResult<{ saved: boolean }>> {
  const user = await getUser();
  if (!user) return { success: false, message: "Vui lòng đăng nhập để lưu phim" };

  const key = { userId_titleId: { userId: user.id, titleId } };
  const existing = await prisma.watchlistItem.findUnique({ where: key });
  if (existing) {
    await prisma.watchlistItem.delete({ where: key });
  } else {
    const title = await prisma.title.findUnique({ where: { id: titleId }, select: { id: true } });
    if (!title) return { success: false, message: "Phim không tồn tại" };
    await prisma.watchlistItem.create({ data: { userId: user.id, titleId } });
  }
  revalidatePath("/library");
  return {
    success: true,
    message: existing ? "Đã xoá khỏi danh sách" : "Đã thêm vào danh sách",
    data: { saved: !existing },
  };
}

export async function removeHistory(id: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { success: false, message: "Vui lòng đăng nhập" };
  await prisma.watchHistory.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/library");
  revalidatePath("/");
  return { success: true, message: "Đã xoá khỏi lịch sử" };
}

export async function clearHistory(): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { success: false, message: "Vui lòng đăng nhập" };
  await prisma.watchHistory.deleteMany({ where: { userId: user.id } });
  revalidatePath("/library");
  revalidatePath("/");
  return { success: true, message: "Đã xoá toàn bộ lịch sử xem" };
}
