import { LinkButton } from "@/components/ui/heroui";
import LibraryView from "@/components/sections/Library/LibraryView";
import SectionTitle from "@/components/ui/other/SectionTitle";
import { getHistories, getWatchlist } from "@/server/queries/library";
import { getSession } from "@/server/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Thư viện" };

export default async function LibraryPage() {
  const session = await getSession();

  if (!session) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <h2>Thư viện của bạn</h2>
        <p className="text-foreground-500 max-w-md">
          Đăng nhập để lưu phim yêu thích, xem lại lịch sử và tiếp tục xem dở trên mọi thiết bị.
        </p>
        <LinkButton href="/auth?next=/library" color="primary" variant="shadow">
          Đăng nhập
        </LinkButton>
      </div>
    );
  }

  const [watchlist, histories] = await Promise.all([
    getWatchlist(session.user.id),
    getHistories(session.user.id),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      <SectionTitle size="h3">Thư viện của tôi</SectionTitle>
      <LibraryView watchlist={watchlist} histories={histories} />
    </div>
  );
}
