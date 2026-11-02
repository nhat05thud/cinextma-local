import DetailPage, { titleMetadata } from "@/components/sections/Title/DetailPage";
import type { Params } from "@/types/dto";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Params<{ slug: string }>) {
  return titleMetadata((await params).slug, "tv");
}

export default async function TvDetailPage({ params }: Params<{ slug: string }>) {
  return <DetailPage slug={(await params).slug} type="tv" />;
}
