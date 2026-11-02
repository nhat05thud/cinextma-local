import VideosTable from "@/components/admin/video/VideosTable";
import { listVideos } from "@/server/queries/admin";
import type { SearchParams } from "@/types/dto";

export const metadata = { title: "Video & xử lý" };

export default async function VideosPage({ searchParams }: SearchParams) {
  const params = await searchParams;
  const filter = typeof params.filter === "string" ? params.filter : "all";
  const data = await listVideos({
    status: filter === "active" ? "active" : filter === "failed" ? "failed" : undefined,
    orphan: filter === "orphan",
    page: Number(params.page) || 1,
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Video & xử lý</h1>
        <p className="text-foreground-500 text-sm">
          Video được xử lý lần lượt từng cái. Có thể nhập file có sẵn trên máy chủ bằng lệnh{" "}
          <code className="bg-default-100 rounded px-1">npm run video:import -- &quot;D:\Phim\ten-phim.mkv&quot;</code>
        </p>
      </div>
      <VideosTable data={data} />
    </div>
  );
}
