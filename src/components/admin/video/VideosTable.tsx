"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Autocomplete,
  AutocompleteItem,
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Pagination,
  Select,
  SelectItem,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tabs,
  Tooltip,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { attachVideoAction, deleteVideo, reprocessVideo } from "@/actions/admin/videos";
import { getTitleEpisodes, searchTitlesForPicker } from "@/actions/admin/manage";
import { formatBytes, formatClock, timeAgo } from "@/lib/format";
import type { listVideos } from "@/server/queries/admin";
import { useAdminAction, useVideoStatuses } from "../hooks";
import VideoStatus from "./VideoStatus";
import { isActiveVideo } from "@/types/media";

type Data = Awaited<ReturnType<typeof listVideos>>;
type Option = { id: string; title: string; type: string; year: number | null };

const AttachModal: React.FC<{ videoId: string | null; onClose: () => void }> = ({ videoId, onClose }) => {
  const { run, pending } = useAdminAction();
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [title, setTitle] = useState<Option | null>(null);
  const [episodes, setEpisodes] = useState<{ id: string; label: string }[]>([]);
  const [episodeId, setEpisodeId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const result = await searchTitlesForPicker(query);
      if (result.success) setOptions(result.data ?? []);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (title?.type !== "tv") return;
    getTitleEpisodes(title.id).then((r) => setEpisodes(r.data ?? []));
  }, [title]);

  const submit = () => {
    if (!videoId || !title) return;
    const target = title.type === "tv" ? { type: "episode" as const, id: episodeId! } : { type: "title" as const, id: title.id };
    run(() => attachVideoAction(videoId, target.type, target.id), { onSuccess: onClose });
  };

  return (
    <Modal isOpen={!!videoId} onClose={onClose}>
      <ModalContent>
        <ModalHeader>Gắn video vào phim</ModalHeader>
        <ModalBody>
          <Autocomplete
            label="Chọn phim"
            inputValue={query}
            onInputChange={setQuery}
            items={options}
            onSelectionChange={(key) => {
              setTitle(options.find((o) => o.id === key) ?? null);
              setEpisodeId(null);
              setEpisodes([]);
            }}
          >
            {(o) => (
              <AutocompleteItem key={o.id} description={`${o.type === "tv" ? "Phim bộ" : "Phim lẻ"}${o.year ? ` • ${o.year}` : ""}`}>
                {o.title}
              </AutocompleteItem>
            )}
          </Autocomplete>
          {title?.type === "tv" && (
            <Select label="Chọn tập" selectedKeys={episodeId ? [episodeId] : []} onSelectionChange={(k) => setEpisodeId(String(Array.from(k)[0] ?? ""))}>
              {episodes.map((e) => (
                <SelectItem key={e.id}>{e.label}</SelectItem>
              ))}
            </Select>
          )}
          <p className="text-foreground-500 text-xs">Nếu phim/tập đã có video, video cũ sẽ được giữ lại trong thư viện.</p>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            Huỷ
          </Button>
          <Button color="primary" isLoading={pending} isDisabled={!title || (title.type === "tv" && !episodeId)} onPress={submit}>
            Gắn video
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

const VideosTable: React.FC<{ data: Data }> = ({ data }) => {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const { run } = useAdminAction();
  const states = useVideoStatuses(data.items);
  const [attachId, setAttachId] = useState<string | null>(null);
  const filter = params.get("filter") ?? "all";

  const go = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in changes)) next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next}`));
  };

  return (
    <div className="flex flex-col gap-4">
      <Tabs selectedKey={filter} onSelectionChange={(k) => go({ filter: k === "all" ? null : String(k) })}>
        <Tab key="all" title="Tất cả" />
        <Tab key="active" title="Đang xử lý" />
        <Tab key="failed" title="Lỗi" />
        <Tab key="orphan" title="Chưa gắn phim" />
      </Tabs>

      <Table aria-label="Danh sách video" isStriped>
        <TableHeader>
          <TableColumn>VIDEO</TableColumn>
          <TableColumn>THÔNG SỐ</TableColumn>
          <TableColumn>THUỘC PHIM</TableColumn>
          <TableColumn>TRẠNG THÁI</TableColumn>
          <TableColumn align="end">THAO TÁC</TableColumn>
        </TableHeader>
        <TableBody emptyContent="Không có video nào.">
          {data.items.map((v) => {
            const state = states[v.id] ?? v;
            const thumb = [...v.frames].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]?.url;
            return (
              <TableRow key={v.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="bg-default-200 aspect-video w-24 shrink-0 overflow-hidden rounded">
                      {thumb && <img src={thumb} alt="" className="size-full object-cover" loading="lazy" />}
                    </div>
                    <div className="min-w-0">
                      <p className="max-w-64 truncate text-sm font-medium" title={v.originalName}>
                        {v.originalName}
                      </p>
                      <p className="text-foreground-500 text-xs">
                        {v.size ? `${formatBytes(v.size)} • ` : ""}
                        {timeAgo(v.createdAt)}
                        {v.sourceUrl && (
                          <>
                            {" • "}
                            <a href={v.sourceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                              {v.sourceSite ?? "Nguồn"}
                            </a>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="text-xs">
                    {v.duration ? formatClock(v.duration) : "—"}
                    {v.width ? ` • ${v.width}×${v.height}` : ""}
                  </p>
                  <p className="text-foreground-500 text-xs">
                    {v.renditions.map((r) => r.name).join(", ") || v.mode}
                    {v.subtitles.length ? ` • ${v.subtitles.length} phụ đề` : ""}
                  </p>
                </TableCell>
                <TableCell>
                  {v.owner ? (
                    <Link href={`/admin/titles/${v.owner.titleId}`} className="text-primary text-sm hover:underline">
                      {v.owner.label}
                    </Link>
                  ) : (
                    <Button size="sm" variant="flat" onPress={() => setAttachId(v.id)}>
                      Gắn vào phim
                    </Button>
                  )}
                </TableCell>
                <TableCell>
                  <VideoStatus state={state} />
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {v.owner && (
                      <Tooltip content="Gắn sang phim khác">
                        <Button isIconOnly size="sm" variant="light" onPress={() => setAttachId(v.id)}>
                          <Icon icon="mdi:link-variant" fontSize={18} />
                        </Button>
                      </Tooltip>
                    )}
                    <Tooltip content="Xử lý lại (tự động)">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        isDisabled={(!v.hasSource && !v.sourceUrl) || isActiveVideo(state.status)}
                        onPress={() => run(() => reprocessVideo(v.id, "auto"))}
                      >
                        <Icon icon="mdi:refresh" fontSize={18} />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Xoá video">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() => confirm(`Xoá vĩnh viễn ${v.originalName}?`) && run(() => deleteVideo(v.id))}
                      >
                        <Icon icon="mdi:delete-outline" fontSize={18} />
                      </Button>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {data.pageCount > 1 && (
        <div className="flex justify-center">
          <Pagination showControls total={data.pageCount} page={data.page} onChange={(p) => go({ page: String(p) })} />
        </div>
      )}
      <AttachModal key={attachId} videoId={attachId} onClose={() => setAttachId(null)} />
    </div>
  );
};

export default VideosTable;
