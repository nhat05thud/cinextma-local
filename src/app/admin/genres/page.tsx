import GenresManager from "@/components/admin/manage/GenresManager";
import { prisma } from "@/server/db";

export const metadata = { title: "Thể loại" };

export default async function GenresPage() {
  const genres = await prisma.genre.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: { _count: { select: { titles: true } } },
  });
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <h1 className="text-2xl font-bold">Thể loại</h1>
      <GenresManager genres={genres.map((g) => ({ id: g.id, name: g.name, slug: g.slug, count: g._count.titles }))} />
    </div>
  );
}
