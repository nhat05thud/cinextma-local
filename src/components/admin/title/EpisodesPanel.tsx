"use client";

import { useMemo, useRef, useState } from "react";
import {
  addToast,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Radio,
  RadioGroup,
  Tab,
  Tabs,
  Textarea,
  Tooltip,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  addEpisodes,
  createSeason,
  deleteEpisode,
  deleteSeason,
  ensureEpisodes,
  updateEpisode,
  updateSeason,
  uploadEpisodeStill,
} from "@/actions/admin/episodes";
import { VIDEO_MODES } from "@/lib/catalog";
import { formatBytes } from "@/lib/format";
import type { TitleForEdit } from "@/server/queries/admin";
import { useAdminAction, useVideoStatuses, type VideoState } from "../hooks";
import { useUploads } from "../upload/UploadManager";
import VideoStatus from "../video/VideoStatus";
import VideoUploader, { VIDEO_ACCEPT } from "../video/VideoUploader";
import VideoPanel from "../video/VideoPanel";
import { parseEpisodeFromName } from "@/lib/filename";

type Season = TitleForEdit["seasons"][number];
type Episode = Season["episodes"][number];

const BulkUploadModal: React.FC<{ isOpen: boolean; onClose: () => void; titleId: string; titleName: string; defaultSeason: number }> = ({
  isOpen,
  onClose,
  titleId,
  titleName,
  defaultSeason,
}) => {
  const { enqueue } = useUploads();
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<{ file: File; season: number; episode: number }[]>([]);
  const [mode, setMode] = useState("auto");
  const [cover, setCover] = useState("auto");
  const [busy, setBusy] = useState(false);

  const pick = (files: FileList | null) => {
    if (!files) return;
    const sorted = Array.from(files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    setRows(sorted.map((file, i) => ({ file, ...parseEpisodeFromName(file.name, defaultSeason, i + 1) })));
  };

  const start = async () => {
    setBusy(true);
    const result = await ensureEpisodes(titleId, rows.map((r) => ({ season: r.season, episode: r.episode })));
    setBusy(false);
    if (!result.success || !result.data) {
      addToast({ title: result.message ?? "Lỗi tạo tập phim", color: "danger" });
      return;
    }
    enqueue(
      rows.map((r, i) => ({
        file: r.file,
        label: `${titleName} • P${r.season} T${r.episode}`,
        target: { targetType: "episode" as const, targetId: result.data![i] },
        mode,
        autoCover: cover === "auto",
      })),
    );
    addToast({ title: `Đã thêm ${rows.length} tập vào hàng đợi tải lên`, color: "primary" });
    setRows([]);
    onClose();
  };

  const duplicates = new Set(
    rows.map((r) => `${r.season}-${r.episode}`).filter((key, i, all) => all.indexOf(key) !== i),
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>Tải nhiều tập lên</ModalHeader>
        <ModalBody>
          <Button variant="flat" color="primary" startContent={<Icon icon="mdi:folder-multiple-outline" fontSize={20} />} onPress={() => input.current?.click()}>
            Chọn nhiều file video
          </Button>
          <input ref={input} type="file" accept={VIDEO_ACCEPT} multiple hidden onChange={(e) => pick(e.target.files)} />
          {rows.length > 0 && (
            <>
              <p className="text-foreground-500 text-sm">Số phần/tập được đoán từ tên file (S01E05, Tập 5, Ep05...). Kiểm tra và sửa lại nếu cần.</p>
              <div className="flex flex-col gap-2">
                {rows.map((row, i) => (
                  <div key={row.file.name + i} className="bg-default-100 flex items-center gap-2 rounded-lg p-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm" title={row.file.name}>
                        {row.file.name}
                      </p>
                      <p className="text-foreground-500 text-xs">{formatBytes(row.file.size)}</p>
                    </div>
                    <Input
                      size="sm"
                      type="number"
                      label="Phần"
                      className="w-20"
                      value={String(row.season)}
                      onValueChange={(v) => setRows((all) => all.map((r, j) => (j === i ? { ...r, season: Number(v) || 1 } : r)))}
                    />
                    <Input
                      size="sm"
                      type="number"
                      label="Tập"
                      className="w-20"
                      isInvalid={duplicates.has(`${row.season}-${row.episode}`)}
                      value={String(row.episode)}
                      onValueChange={(v) => setRows((all) => all.map((r, j) => (j === i ? { ...r, episode: Number(v) || 1 } : r)))}
                    />
                    <Button isIconOnly size="sm" variant="light" onPress={() => setRows((all) => all.filter((_, j) => j !== i))}>
                      <Icon icon="mdi:close" />
                    </Button>
                  </div>
                ))}
              </div>
              <RadioGroup label="Chế độ xử lý" orientation="horizontal" size="sm" value={mode} onValueChange={setMode}>
                {VIDEO_MODES.map((m) => (
                  <Radio key={m.value} value={m.value}>
                    {m.label}
                  </Radio>
                ))}
              </RadioGroup>
              <RadioGroup label="Ảnh tập" orientation="horizontal" size="sm" value={cover} onValueChange={setCover}>
                <Radio value="auto">Tự tạo từ video</Radio>
                <Radio value="manual">Tôi sẽ tự tải ảnh lên sau</Radio>
              </RadioGroup>
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            Đóng
          </Button>
          <Button color="primary" isDisabled={!rows.length || duplicates.size > 0} isLoading={busy} onPress={start}>
            Tải lên {rows.length ? `${rows.length} tập` : ""}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

const EpisodeModal: React.FC<{
  episode: Episode;
  season: Season;
  titleId: string;
  titleName: string;
  onClose: () => void;
}> = ({ episode, season, titleId, titleName, onClose }) => {
  const { run, pending } = useAdminAction();
  const stillInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    number: episode.number,
    name: episode.name ?? "",
    overview: episode.overview ?? "",
    runtime: episode.runtime,
    airDate: episode.airDate ?? "",
  });

  return (
    <Modal isOpen onClose={onClose} size="5xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>
          {titleName} • {season.name ?? `Phần ${season.number}`} • Tập {episode.number}
        </ModalHeader>
        <ModalBody className="pb-6">
          <Tabs defaultSelectedKey={episode.video ? "video" : "info"}>
            <Tab key="info" title="Thông tin tập">
              <div className="grid gap-4 md:grid-cols-[260px_1fr]">
                <div className="flex flex-col gap-2">
                  <div className="bg-default-100 aspect-video overflow-hidden rounded-xl">
                    {episode.still ? (
                      <img src={episode.still} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="text-foreground-400 flex size-full items-center justify-center text-sm">Chưa có ảnh tập</div>
                    )}
                  </div>
                  <Button size="sm" variant="flat" onPress={() => stillInput.current?.click()} startContent={<Icon icon="mdi:upload" />}>
                    Tải ảnh tập lên
                  </Button>
                  <p className="text-foreground-500 text-xs">Hoặc chọn từ khung hình ở tab Video.</p>
                  <input
                    ref={stillInput}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const data = new FormData();
                      data.set("file", file);
                      run(() => uploadEpisodeStill(episode.id, data));
                    }}
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-3 gap-3">
                    <Input type="number" label="Số tập" value={String(form.number)} onValueChange={(v) => setForm((f) => ({ ...f, number: Number(v) || 1 }))} />
                    <Input
                      type="number"
                      label="Thời lượng (phút)"
                      value={form.runtime?.toString() ?? ""}
                      onValueChange={(v) => setForm((f) => ({ ...f, runtime: v ? Number(v) : null }))}
                    />
                    <Input type="date" label="Ngày phát sóng" value={form.airDate} onValueChange={(v) => setForm((f) => ({ ...f, airDate: v }))} />
                  </div>
                  <Input label="Tên tập" value={form.name} onValueChange={(v) => setForm((f) => ({ ...f, name: v }))} />
                  <Textarea label="Nội dung tập" value={form.overview} onValueChange={(v) => setForm((f) => ({ ...f, overview: v }))} />
                  <div className="flex justify-end">
                    <Button color="primary" isLoading={pending} onPress={() => run(() => updateEpisode(episode.id, form))}>
                      Lưu
                    </Button>
                  </div>
                </div>
              </div>
            </Tab>
            <Tab key="video" title={episode.video ? "Video" : "Tải video lên"}>
              <div className="flex flex-col gap-4">
                {episode.video && (
                  <VideoPanel video={episode.video} target={{ kind: "episode", titleId, episodeId: episode.id }} />
                )}
                <Card shadow="sm">
                  <CardHeader className="font-semibold">{episode.video ? "Thay video khác" : "Tải video cho tập này"}</CardHeader>
                  <CardBody className="pt-0">
                    <VideoUploader
                      kind="episode"
                      replacing={!!episode.video}
                      target={{ targetType: "episode", targetId: episode.id }}
                      label={`${titleName} • P${season.number} T${episode.number}`}
                    />
                  </CardBody>
                </Card>
              </div>
            </Tab>
          </Tabs>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

const EpisodeRow: React.FC<{
  episode: Episode;
  season: Season;
  state: VideoState | undefined;
  titleName: string;
  onOpen: () => void;
}> = ({ episode, season, state, titleName, onOpen }) => {
  const { enqueue } = useUploads();
  const { run } = useAdminAction();
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-default-100 hover:bg-default-200 flex items-center gap-3 rounded-xl p-2 transition-colors">
      <button type="button" onClick={onOpen} className="bg-default-200 aspect-video w-28 shrink-0 overflow-hidden rounded-lg">
        {episode.still ? <img src={episode.still} alt="" className="size-full object-cover" loading="lazy" /> : null}
      </button>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-semibold">
          Tập {episode.number}
          {episode.name ? `: ${episode.name}` : ""}
        </p>
        <p className="text-foreground-500 truncate text-xs">
          {episode.video ? episode.video.originalName : "Chưa có video"}
          {episode.runtime ? ` • ${episode.runtime} phút` : ""}
        </p>
      </button>
      <div className="hidden shrink-0 sm:block">{state ? <VideoStatus state={state} compact /> : null}</div>
      <div className="flex shrink-0">
        <Tooltip content={episode.video ? "Thay video" : "Tải video lên"}>
          <Button isIconOnly size="sm" variant="light" onPress={() => input.current?.click()}>
            <Icon icon="mdi:upload" fontSize={18} />
          </Button>
        </Tooltip>
        <Tooltip content="Chi tiết">
          <Button isIconOnly size="sm" variant="light" onPress={onOpen}>
            <Icon icon="mdi:pencil" fontSize={18} />
          </Button>
        </Tooltip>
        <Tooltip content="Xoá tập">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            color="danger"
            onPress={() => confirm(`Xoá tập ${episode.number}${episode.video ? " và video của tập" : ""}?`) && run(() => deleteEpisode(episode.id, true))}
          >
            <Icon icon="mdi:delete-outline" fontSize={18} />
          </Button>
        </Tooltip>
      </div>
      <input
        ref={input}
        type="file"
        accept={VIDEO_ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          enqueue([
            {
              file,
              label: `${titleName} • P${season.number} T${episode.number}`,
              target: { targetType: "episode", targetId: episode.id },
              mode: "auto",
              autoCover: true,
            },
          ]);
          addToast({ title: "Đã thêm vào hàng đợi tải lên", color: "primary" });
        }}
      />
    </div>
  );
};

const EpisodesPanel: React.FC<{ titleId: string; titleName: string; seasons: Season[] }> = ({ titleId, titleName, seasons }) => {
  const { run, pending } = useAdminAction();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [openEpisode, setOpenEpisode] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState(String(seasons[0]?.number ?? 1));
  const videos = useMemo(() => seasons.flatMap((s) => s.episodes.flatMap((e) => (e.video ? [e.video] : []))), [seasons]);
  const states = useVideoStatuses(videos);

  const season = seasons.find((s) => String(s.number) === selectedSeason) ?? seasons[0];
  const current = seasons.flatMap((s) => s.episodes.map((e) => ({ s, e }))).find((x) => x.e.id === openEpisode);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button color="primary" variant="shadow" startContent={<Icon icon="mdi:upload-multiple" fontSize={20} />} onPress={() => setBulkOpen(true)}>
          Tải nhiều tập lên
        </Button>
        <Button variant="flat" isLoading={pending} startContent={<Icon icon="mdi:plus" fontSize={20} />} onPress={() => run(() => createSeason(titleId))}>
          Thêm phần mới
        </Button>
      </div>

      {seasons.length === 0 ? (
        <p className="text-foreground-500">Chưa có phần nào. Bấm “Thêm phần mới” hoặc “Tải nhiều tập lên”.</p>
      ) : (
        <Card shadow="sm">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <Tabs selectedKey={selectedSeason} onSelectionChange={(k) => setSelectedSeason(String(k))} color="warning" variant="underlined">
              {seasons.map((s) => (
                <Tab key={String(s.number)} title={`${s.name || `Phần ${s.number}`} (${s.episodes.length})`} />
              ))}
            </Tabs>
            {season && (
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="flat" onPress={() => run(() => addEpisodes(season.id, 1))}>
                  + 1 tập
                </Button>
                <Button size="sm" variant="flat" onPress={() => run(() => addEpisodes(season.id, 10))}>
                  + 10 tập
                </Button>
                <Button
                  size="sm"
                  variant="light"
                  onPress={() => {
                    const name = prompt("Tên phần:", season.name ?? `Phần ${season.number}`);
                    if (name !== null) run(() => updateSeason(season.id, { name, overview: season.overview }));
                  }}
                >
                  Đổi tên
                </Button>
                <Button
                  size="sm"
                  variant="light"
                  color="danger"
                  onPress={() => confirm(`Xoá ${season.name ?? `Phần ${season.number}`} cùng toàn bộ tập và video?`) && run(() => deleteSeason(season.id, true))}
                >
                  Xoá phần
                </Button>
              </div>
            )}
          </CardHeader>
          <CardBody className="flex flex-col gap-2 pt-0">
            {season?.episodes.length ? (
              season.episodes.map((episode) => (
                <EpisodeRow
                  key={episode.id}
                  episode={episode}
                  season={season}
                  state={episode.video ? (states[episode.video.id] ?? episode.video) : undefined}
                  titleName={titleName}
                  onOpen={() => setOpenEpisode(episode.id)}
                />
              ))
            ) : (
              <p className="text-foreground-500 py-6 text-center text-sm">Phần này chưa có tập nào.</p>
            )}
          </CardBody>
        </Card>
      )}

      <BulkUploadModal
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        titleId={titleId}
        titleName={titleName}
        defaultSeason={Number(selectedSeason) || 1}
      />
      {current && (
        <EpisodeModal
          key={current.e.id}
          episode={current.e}
          season={current.s}
          titleId={titleId}
          titleName={titleName}
          onClose={() => setOpenEpisode(null)}
        />
      )}
    </div>
  );
};

export default EpisodesPanel;
