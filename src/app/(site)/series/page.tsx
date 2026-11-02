import DiscoverView from "@/components/sections/Discover/DiscoverView";
import type { SearchParams } from "@/types/dto";

export const dynamic = "force-dynamic";
export const metadata = { title: "Phim bộ" };

export default async function SeriesPage({ searchParams }: SearchParams) {
  return <DiscoverView heading="Phim bộ" fixedType="tv" params={await searchParams} />;
}
