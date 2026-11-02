import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRelated, getTitleDetail } from "@/server/queries/titles";
import { isInWatchlist } from "@/server/queries/library";
import { getSession, isAdminUser } from "@/server/session";
import type { ContentType } from "@/types/dto";
import TitleRow from "./TitleRow";
import Episodes from "./Episodes";
import { DetailBackdrop, DetailCast, DetailOverview } from "./Detail";
import { Alert } from "@/components/ui/heroui";

export async function titleMetadata(slug: string, type: ContentType): Promise<Metadata> {
  const title = await getTitleDetail(slug, type, true);
  if (!title) return {};
  return {
    title: title.title,
    description: title.overview ?? undefined,
    openGraph: { images: title.backdrop ? [title.backdrop] : title.poster ? [title.poster] : [] },
  };
}

/** Trang chi tiết dùng chung cho phim lẻ và phim bộ. */
export default async function DetailPage({ slug, type }: { slug: string; type: ContentType }) {
  const session = await getSession();
  const admin = isAdminUser(session?.user);
  const title = await getTitleDetail(slug, type, admin);
  if (!title) notFound();

  const [related, saved] = await Promise.all([getRelated(title), isInWatchlist(session?.user.id, title.id)]);
  const color = type === "tv" ? "warning" : "primary";

  return (
    <div className="mx-auto max-w-5xl">
      <DetailBackdrop title={title} />
      <div className="flex flex-col gap-10">
        <DetailOverview title={title} saved={saved} />
        {admin && title.playHref === null && (
          <Alert
            className="z-3"
            color="warning"
            title="Phim chưa có video sẵn sàng để phát"
            description="Vào trang quản trị để tải video lên hoặc chờ xử lý xong."
          />
        )}
        {type === "tv" && <Episodes slug={title.slug} seasons={title.seasons} />}
        <DetailCast cast={title.cast} color={color} />
        {related.length > 0 && (
          <TitleRow row={{ key: "related", name: "Có thể bạn sẽ thích", href: null, items: related }} color={color} />
        )}
      </div>
    </div>
  );
}
