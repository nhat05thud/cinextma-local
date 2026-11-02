import DetailPage, { titleMetadata } from "@/components/sections/Title/DetailPage";
import type { Params } from "@/types/dto";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Params<{ slug: string }>) {
  return titleMetadata((await params).slug, "movie");
}

export default async function MovieDetailPage({ params }: Params<{ slug: string }>) {
  return <DetailPage slug={(await params).slug} type="movie" />;
}
