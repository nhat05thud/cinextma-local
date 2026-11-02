import { LinkButton } from "@/components/ui/heroui";
import TitlesTable from "@/components/admin/title/TitlesTable";
import { listTitles } from "@/server/queries/admin";
import type { SearchParams } from "@/types/dto";

export const metadata = { title: "Quản lý phim" };

export default async function TitlesPage({ searchParams }: SearchParams) {
  const params = await searchParams;
  const value = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const data = await listTitles({ q: value("q"), type: value("type"), status: value("status"), page: Number(value("page")) || 1 });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Quản lý phim</h1>
        <LinkButton href="/admin/titles/new" color="primary" variant="shadow">
          + Thêm phim
        </LinkButton>
      </div>
      <TitlesTable data={data} />
    </div>
  );
}
