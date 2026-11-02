import { LinkChip } from "@/components/ui/heroui";
import SearchBox from "@/components/sections/Search/SearchBox";
import TitleGrid from "@/components/sections/Title/TitleGrid";
import SectionTitle from "@/components/ui/other/SectionTitle";
import { discoverTitles, getFilterOptions } from "@/server/queries/titles";
import type { SearchParams } from "@/types/dto";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tìm kiếm" };

export default async function SearchPage({ searchParams }: SearchParams) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  const [result, options] = await Promise.all([
    q ? discoverTitles({ q, pageSize: 60 }) : discoverTitles({ sort: "views", pageSize: 18 }),
    getFilterOptions(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="mx-auto w-full max-w-2xl">
        <SearchBox />
      </div>
      {q ? (
        <>
          <p className="text-foreground-500 text-sm">
            {result.total} kết quả cho “<span className="text-foreground font-semibold">{q}</span>”
          </p>
          <TitleGrid titles={result.items} empty="Không tìm thấy phim nào. Hãy thử từ khoá khác." />
        </>
      ) : (
        <>
          {options.genres.length > 0 && (
            <div className="flex flex-col gap-3">
              <SectionTitle size="h6">Duyệt theo thể loại</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {options.genres.map((g) => (
                  <LinkChip key={g.slug} href={`/discover?genre=${g.slug}`} variant="flat">
                    {g.name}
                  </LinkChip>
                ))}
              </div>
            </div>
          )}
          <SectionTitle size="h6">Được xem nhiều</SectionTitle>
          <TitleGrid titles={result.items} />
        </>
      )}
    </div>
  );
}
