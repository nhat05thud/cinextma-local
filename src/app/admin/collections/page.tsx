import CollectionsManager from "@/components/admin/manage/CollectionsManager";
import { prisma } from "@/server/db";
import { mediaUrl } from "@/lib/media";

export const metadata = { title: "Trang chủ" };

export default async function CollectionsPage() {
  const collections = await prisma.collection.findMany({
    orderBy: { position: "asc" },
    include: { items: { orderBy: { position: "asc" }, include: { title: { select: { id: true, title: true, type: true, posterPath: true } } } } },
  });
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Sắp xếp trang chủ</h1>
        <p className="text-foreground-500 text-sm">
          Banner lớn đầu trang lấy từ các phim bật “Banner trang chủ”. Các hàng tự động (Mới cập nhật, Xem nhiều, Đánh giá cao...) luôn có sẵn;
          tạo thêm hàng phim tuỳ chỉnh bên dưới (ví dụ “Phim Tết”, “Marvel”...).
        </p>
      </div>
      <CollectionsManager
        collections={collections.map((c) => ({
          id: c.id,
          name: c.name,
          active: c.active,
          items: c.items.map((i) => ({ id: i.title.id, title: i.title.title, type: i.title.type, poster: mediaUrl(i.title.posterPath) })),
        }))}
      />
    </div>
  );
}
