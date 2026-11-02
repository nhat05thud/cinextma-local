import { z } from "zod";
import { prisma } from "@/server/db";
import { auth } from "@/server/auth";

const schema = z.object({
  titleId: z.string().min(1),
  episodeId: z.string().min(1).nullable().optional(),
  position: z.number().min(0),
  duration: z.number().min(0),
  /** "start": tính 1 lượt xem; "progress"/"ended": lưu vị trí */
  event: z.enum(["start", "progress", "ended"]).default("progress"),
});

/**
 * Lưu tiến độ xem. Nhận cả request từ navigator.sendBeacon (Content-Type text/plain) khi đóng tab.
 */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
  const { titleId, episodeId, position, duration, event } = parsed.data;

  const session = await auth.api.getSession({ headers: request.headers });
  const userId = session?.user.id;

  if (event === "start") {
    const title = await prisma.title.findUnique({ where: { id: titleId }, select: { id: true } });
    if (!title) return Response.json({ ok: false }, { status: 404 });
    await prisma.$transaction([
      prisma.title.update({ where: { id: titleId }, data: { viewCount: { increment: 1 } } }),
      prisma.viewEvent.create({ data: { titleId, episodeId: episodeId ?? null, userId: userId ?? null } }),
    ]);
  }

  if (userId && duration > 0) {
    const mediaKey = episodeId ? `${titleId}:${episodeId}` : titleId;
    // Coi như xem hết khi tới 95% hoặc còn < 30 giây (phim dài, thường là phần credit)
    const completed = event === "ended" || position / duration > 0.95 || (duration > 600 && duration - position < 30);
    const data = { position: completed ? 0 : position, duration, completed };
    await prisma.watchHistory.upsert({
      where: { userId_mediaKey: { userId, mediaKey } },
      update: data,
      create: { ...data, userId, titleId, episodeId: episodeId ?? null, mediaKey },
    });
  }

  return Response.json({ ok: true });
}
