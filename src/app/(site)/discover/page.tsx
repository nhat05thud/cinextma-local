import DiscoverView from "@/components/sections/Discover/DiscoverView";
import type { SearchParams } from "@/types/dto";

export const dynamic = "force-dynamic";
export const metadata = { title: "Khám phá" };

export default async function DiscoverPage({ searchParams }: SearchParams) {
  return <DiscoverView heading="Khám phá phim" params={await searchParams} />;
}
