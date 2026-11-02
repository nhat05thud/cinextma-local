"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Chip,
  Input,
  Pagination,
  Select,
  SelectItem,
  Spinner,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tooltip,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useDebouncedValue } from "@mantine/hooks";
import { setTitleStatus } from "@/actions/admin/titles";
import { timeAgo } from "@/lib/format";
import type { listTitles } from "@/server/queries/admin";
import { useAdminAction } from "../hooks";
import VideoStatus from "../video/VideoStatus";

type Data = Awaited<ReturnType<typeof listTitles>>;

const TitlesTable: React.FC<{ data: Data }> = ({ data }) => {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [navigating, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [debounced] = useDebouncedValue(q, 400);
  const { run } = useAdminAction();

  const setParam = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in changes)) next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next}`));
  };

  useEffect(() => {
    if ((params.get("q") ?? "") !== debounced) setParam({ q: debounced || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          size="sm"
          className="max-w-xs"
          placeholder="Tìm theo tên phim, diễn viên..."
          value={q}
          onValueChange={setQ}
          isClearable
          onClear={() => setQ("")}
          startContent={<Icon icon="mdi:magnify" fontSize={18} />}
        />
        <Select
          size="sm"
          aria-label="Loại"
          className="w-36"
          selectedKeys={[params.get("type") ?? "all"]}
          onSelectionChange={(k) => setParam({ type: String(Array.from(k)[0]) === "all" ? null : String(Array.from(k)[0]) })}
        >
          <SelectItem key="all">Tất cả loại</SelectItem>
          <SelectItem key="movie">Phim lẻ</SelectItem>
          <SelectItem key="tv">Phim bộ</SelectItem>
        </Select>
        <Select
          size="sm"
          aria-label="Trạng thái"
          className="w-40"
          selectedKeys={[params.get("status") ?? "all"]}
          onSelectionChange={(k) => setParam({ status: String(Array.from(k)[0]) === "all" ? null : String(Array.from(k)[0]) })}
        >
          <SelectItem key="all">Mọi trạng thái</SelectItem>
          <SelectItem key="published">Đã xuất bản</SelectItem>
          <SelectItem key="draft">Bản nháp</SelectItem>
        </Select>
        {navigating && <Spinner size="sm" />}
        <span className="text-foreground-500 ml-auto text-sm">{data.total} phim</span>
      </div>

      <Table aria-label="Danh sách phim" removeWrapper={false} isStriped>
        <TableHeader>
          <TableColumn>PHIM</TableColumn>
          <TableColumn>VIDEO / TẬP</TableColumn>
          <TableColumn>LƯỢT XEM</TableColumn>
          <TableColumn>CẬP NHẬT</TableColumn>
          <TableColumn>XUẤT BẢN</TableColumn>
          <TableColumn align="end">THAO TÁC</TableColumn>
        </TableHeader>
        <TableBody emptyContent="Chưa có phim nào.">
          {data.items.map((t) => (
            <TableRow key={t.id}>
              <TableCell>
                <Link href={`/admin/titles/${t.id}`} className="flex items-center gap-3">
                  <div className="bg-default-200 aspect-2/3 w-10 shrink-0 overflow-hidden rounded">
                    {t.poster && <img src={t.poster} alt="" className="size-full object-cover" loading="lazy" />}
                  </div>
                  <div className="min-w-0">
                    <p className="hover:text-primary max-w-72 truncate font-semibold">{t.title}</p>
                    <div className="flex items-center gap-1">
                      <Chip size="sm" variant="flat" color={t.type === "tv" ? "warning" : "primary"}>
                        {t.type === "tv" ? "Phim bộ" : "Phim lẻ"}
                      </Chip>
                      {t.year && <span className="text-foreground-500 text-xs">{t.year}</span>}
                      {t.featured && (
                        <Tooltip content="Đang ở banner trang chủ">
                          <Icon icon="mdi:star" className="text-warning" />
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </Link>
              </TableCell>
              <TableCell>
                {t.type === "movie" ? (
                  t.video ? (
                    <VideoStatus state={{ id: t.id, status: t.video.status, progress: t.video.progress, stage: null, error: null }} compact />
                  ) : (
                    <Chip size="sm" variant="flat">
                      Chưa có video
                    </Chip>
                  )
                ) : (
                  <span className="text-sm">
                    {t.episodes.ready}/{t.episodes.total} tập
                  </span>
                )}
              </TableCell>
              <TableCell>{t.viewCount}</TableCell>
              <TableCell>
                <span className="text-foreground-500 text-xs">{timeAgo(t.updatedAt)}</span>
              </TableCell>
              <TableCell>
                <Switch
                  size="sm"
                  color="success"
                  isSelected={t.status === "published"}
                  onValueChange={(v) => run(() => setTitleStatus(t.id, v ? "published" : "draft"))}
                  aria-label="Xuất bản"
                />
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button as={Link} href={`/admin/titles/${t.id}`} size="sm" variant="flat" startContent={<Icon icon="mdi:pencil" />}>
                    Sửa
                  </Button>
                  <Tooltip content="Xem trên web">
                    <Button as={Link} href={`/${t.type === "tv" ? "tv" : "movie"}/${t.slug}`} target="_blank" size="sm" variant="light" isIconOnly>
                      <Icon icon="mdi:open-in-new" fontSize={18} />
                    </Button>
                  </Tooltip>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {data.pageCount > 1 && (
        <div className="flex justify-center">
          <Pagination showControls total={data.pageCount} page={data.page} onChange={(p) => setParam({ page: String(p) })} />
        </div>
      )}
    </div>
  );
};

export default TitlesTable;
