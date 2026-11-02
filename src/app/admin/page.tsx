import Link from "next/link";
import { Card, CardBody, CardHeader, Chip, Icon, LinkButton, Progress } from "@/components/ui/heroui";
import ViewsChart from "@/components/admin/dashboard/ViewsChart";
import { getDashboard } from "@/server/queries/admin";
import { formatBytes, formatCount, timeAgo } from "@/lib/format";

export const metadata = { title: "Tổng quan" };

const STATUS_COLOR = { queued: "default", processing: "warning", ready: "success", failed: "danger" } as const;
const STATUS_LABEL = { queued: "Chờ xử lý", processing: "Đang xử lý", ready: "Sẵn sàng", failed: "Lỗi" } as const;

const Stat: React.FC<{ icon: string; label: string; value: string | number; href?: string; hint?: string }> = ({ icon, label, value, href, hint }) => {
  const body = (
    <Card shadow="sm" className="h-full">
      <CardBody className="flex flex-row items-center gap-3 p-4">
        <div className="bg-default-100 text-foreground-600 flex size-11 shrink-0 items-center justify-center rounded-xl">
          <Icon icon={icon} fontSize={24} />
        </div>
        <div className="min-w-0">
          <p className="text-foreground-500 text-xs">{label}</p>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          {hint && <p className="text-foreground-500 truncate text-[11px]">{hint}</p>}
        </div>
      </CardBody>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
};

export default async function DashboardPage() {
  const d = await getDashboard();
  const diskUsed = d.storage.disk ? d.storage.disk.total - d.storage.disk.free : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Tổng quan</h1>
        <LinkButton href="/admin/titles/new" color="primary" variant="shadow">
          + Thêm phim
        </LinkButton>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat icon="mdi:movie-open-outline" label="Phim lẻ" value={d.counts.movies} href="/admin/titles?type=movie" />
        <Stat icon="mdi:television-classic" label="Phim bộ" value={d.counts.series} href="/admin/titles?type=tv" hint={`${d.counts.episodes} tập`} />
        <Stat icon="mdi:check-decagram-outline" label="Đã xuất bản" value={d.counts.published} href="/admin/titles?status=published" />
        <Stat icon="mdi:account-group-outline" label="Người dùng" value={d.counts.users} href="/admin/users" />
        <Stat
          icon="mdi:cog-sync-outline"
          label="Video đang xử lý"
          value={d.counts.queue}
          href="/admin/videos?filter=active"
          hint={d.counts.failed ? `${d.counts.failed} video lỗi` : undefined}
        />
        <Stat icon="mdi:harddisk" label="Dung lượng media" value={formatBytes(d.storage.media + d.storage.originals)} hint={`gốc ${formatBytes(d.storage.originals)}`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card shadow="sm">
          <CardHeader className="flex items-end justify-between">
            <div>
              <p className="font-semibold">Lượt xem 14 ngày gần nhất</p>
              <p className="text-foreground-500 text-xs">Tính 1 lượt khi người xem phát quá 10 giây</p>
            </div>
            <p className="text-3xl font-bold tabular-nums">{formatCount(d.totalViews14d)}</p>
          </CardHeader>
          <CardBody className="pt-2">
            <ViewsChart days={d.viewsByDay} />
          </CardBody>
        </Card>

        <Card shadow="sm">
          <CardHeader className="font-semibold">Xem nhiều nhất</CardHeader>
          <CardBody className="flex flex-col gap-2 pt-0">
            {d.topTitles.length ? (
              d.topTitles.map((t, i) => (
                <Link key={t.id} href={`/admin/titles/${t.id}`} className="hover:bg-default-100 flex items-center gap-3 rounded-lg p-1.5">
                  <span className="text-foreground-500 w-4 text-sm font-bold">{i + 1}</span>
                  <div className="bg-default-200 aspect-2/3 w-8 shrink-0 overflow-hidden rounded">
                    {t.poster && <img src={t.poster} alt="" className="size-full object-cover" />}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                  <span className="text-foreground-500 text-xs tabular-nums">{formatCount(t.viewCount)}</span>
                </Link>
              ))
            ) : (
              <p className="text-foreground-500 text-sm">Chưa có lượt xem.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Card shadow="sm">
          <CardHeader className="flex justify-between">
            <span className="font-semibold">Video tải lên gần đây</span>
            <Link href="/admin/videos" className="text-primary text-sm">
              Xem tất cả
            </Link>
          </CardHeader>
          <CardBody className="flex flex-col gap-1 pt-0">
            {d.recentVideos.length ? (
              d.recentVideos.map((v) => (
                <div key={v.id} className="flex items-center gap-3 rounded-lg p-1.5">
                  <Icon icon="mdi:file-video-outline" className="text-foreground-500 shrink-0" fontSize={20} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{v.originalName}</p>
                    {v.owner ? (
                      <Link href={`/admin/titles/${v.owner.titleId}`} className="text-primary truncate text-xs">
                        {v.owner.label}
                      </Link>
                    ) : (
                      <p className="text-foreground-500 text-xs">Chưa gắn phim</p>
                    )}
                  </div>
                  <span className="text-foreground-500 hidden text-xs sm:inline">{timeAgo(v.createdAt)}</span>
                  <Chip size="sm" variant="flat" color={STATUS_COLOR[v.status as keyof typeof STATUS_COLOR] ?? "default"}>
                    {STATUS_LABEL[v.status as keyof typeof STATUS_LABEL] ?? v.status}
                    {v.status === "processing" ? ` ${Math.round(v.progress)}%` : ""}
                  </Chip>
                </div>
              ))
            ) : (
              <p className="text-foreground-500 text-sm">Chưa có video nào.</p>
            )}
          </CardBody>
        </Card>

        <Card shadow="sm">
          <CardHeader className="font-semibold">Ổ đĩa lưu media</CardHeader>
          <CardBody className="flex flex-col gap-3 pt-0">
            {d.storage.disk ? (
              <>
                <Progress
                  aria-label="Dung lượng ổ đĩa"
                  value={(diskUsed / d.storage.disk.total) * 100}
                  color={d.storage.disk.free / d.storage.disk.total < 0.1 ? "danger" : "primary"}
                />
                <p className="text-sm">
                  Còn trống <b>{formatBytes(d.storage.disk.free)}</b> / {formatBytes(d.storage.disk.total)}
                </p>
              </>
            ) : (
              <p className="text-foreground-500 text-sm">Không đọc được thông tin ổ đĩa.</p>
            )}
            <div className="text-foreground-500 text-xs">
              <p>HLS, ảnh, phụ đề: {formatBytes(d.storage.media)}</p>
              <p>File gốc: {formatBytes(d.storage.originals)}</p>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
