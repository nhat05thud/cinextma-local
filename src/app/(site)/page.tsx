import { LinkButton } from "@/components/ui/heroui";
import HeroSlider from "@/components/sections/Home/HeroSlider";
import ContinueWatching from "@/components/sections/Home/ContinueWatching";
import TitleRow from "@/components/sections/Title/TitleRow";
import { getFeatured, getHomeRows } from "@/server/queries/titles";
import { getHistories } from "@/server/queries/library";
import { getSettings } from "@/server/queries/settings";
import { getSession, isAdminUser } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [session, settings] = await Promise.all([getSession(), getSettings()]);
  const [featured, rows, continueWatching] = await Promise.all([
    getFeatured(),
    getHomeRows(settings.homeRowLimit),
    session ? getHistories(session.user.id, { continueOnly: true, limit: 12 }) : Promise.resolve([]),
  ]);

  if (!rows.length) {
    const admin = isAdminUser(session?.user);
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <h2>Chưa có phim nào</h2>
        <p className="text-foreground-500 max-w-md">
          {admin
            ? "Vào trang quản trị để thêm phim lẻ, phim bộ và tải video lên."
            : "Kho phim đang được cập nhật, bạn quay lại sau nhé."}
        </p>
        {admin && (
          <LinkButton href="/admin/titles/new" color="primary" variant="shadow">
            Thêm phim đầu tiên
          </LinkButton>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 md:gap-12">
      <HeroSlider titles={featured} />
      <ContinueWatching items={continueWatching} />
      {rows.map((row) => (
        <TitleRow key={row.key} row={row} color={row.key === "series" ? "warning" : "primary"} />
      ))}
    </div>
  );
}
