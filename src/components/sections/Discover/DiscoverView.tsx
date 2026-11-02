import SectionTitle from "@/components/ui/other/SectionTitle";
import TitleGrid from "@/components/sections/Title/TitleGrid";
import { discoverTitles, getFilterOptions } from "@/server/queries/titles";
import { DiscoverFilters, DiscoverPagination } from "./Filters";

type RawParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function DiscoverView({
  heading,
  params,
  fixedType,
}: {
  heading: string;
  params: RawParams;
  fixedType?: "movie" | "tv";
}) {
  const filters = {
    type: fixedType ?? first(params.type),
    genre: first(params.genre),
    country: first(params.country),
    year: Number(first(params.year)) || undefined,
    sort: first(params.sort),
    page: Number(first(params.page)) || 1,
  };
  const [options, result] = await Promise.all([getFilterOptions(), discoverTitles(filters)]);
  const genreName = options.genres.find((g) => g.slug === filters.genre)?.name;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <SectionTitle color={fixedType === "tv" ? "warning" : "primary"} size="h3">
          {genreName ? `${heading} • ${genreName}` : heading}
        </SectionTitle>
        <p className="text-foreground-500 pl-4 text-sm">{result.total} phim</p>
      </div>
      <DiscoverFilters options={options} hideType={!!fixedType} />
      <TitleGrid titles={result.items} empty="Không tìm thấy phim phù hợp với bộ lọc." />
      <DiscoverPagination page={result.page} pageCount={result.pageCount} />
    </div>
  );
}
