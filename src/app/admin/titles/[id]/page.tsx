import { notFound } from "next/navigation";
import TitleEditor from "@/components/admin/title/TitleEditor";
import { prisma } from "@/server/db";
import { getTitleForEdit } from "@/server/queries/admin";
import type { Params } from "@/types/dto";

export async function generateMetadata({ params }: Params<{ id: string }>) {
  const title = await prisma.title.findUnique({ where: { id: (await params).id }, select: { title: true } });
  return { title: title?.title ?? "Phim" };
}

export default async function EditTitlePage({ params }: Params<{ id: string }>) {
  const { id } = await params;
  const [data, genres] = await Promise.all([
    getTitleForEdit(id),
    prisma.genre.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!data) notFound();
  return <TitleEditor key={data.id} data={data} genres={genres} />;
}
