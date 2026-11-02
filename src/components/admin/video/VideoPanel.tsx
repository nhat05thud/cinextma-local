"use client";

import "@videojs/react/video/skin.css";
import "@videojs/react/i18n/locales/vi/register";
import { useState } from "react";
import type { CSSProperties } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Select,
  SelectItem,
  Switch,
  Tooltip,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { I18nProvider } from "@videojs/react/i18n";
import { VideoPlayer, VideoSkin, usePlayer } from "@videojs/react/video";
import { HlsJsVideo } from "@videojs/react/media/hlsjs-video";
import {
  cancelVideo,
  captureFrame,
  deleteFrame,
  deleteSubtitle,
  deleteVideo,
  detachVideo,
  reprocessVideo,
  setAutoCover,
  setDefaultSubtitle,
  uploadSubtitle,
} from "@/actions/admin/videos";
import { setTitleImageFromFrame } from "@/actions/admin/titles";
import { setEpisodeStillFromFrame } from "@/actions/admin/episodes";
import { SUBTITLE_LANG_OPTIONS } from "@/lib/subtitle-langs";
import { VIDEO_MODES } from "@/lib/catalog";
import { formatBytes, formatClock, formatDate } from "@/lib/format";
import type { AdminVideo } from "@/server/queries/admin";
import { useAdminAction, useVideoStatuses } from "../hooks";
import VideoStatus from "./VideoStatus";
import { isActiveVideo } from "@/types/media";

export type FrameTarget = { kind: "movie"; titleId: string } | { kind: "episode"; titleId: string; episodeId: string };

/** Nút chụp khung hình tại thời điểm đang xem trong trình phát xem trước. */
const CaptureButton: React.FC<{ videoId: string }> = ({ videoId }) => {
  const time = usePlayer((s) => s.currentTime);
  const { run, pending } = useAdminAction();
  return (
    <Button
      size="sm"
      color="secondary"
      variant="shadow"
      isLoading={pending}
      startContent={!pending && <Icon icon="mdi:camera" fontSize={18} />}
      onPress={() => run(() => captureFrame(videoId, time))}
      className="absolute top-3 right-3 z-[35]"
    >
      Chụp khung hình {formatClock(time)}
    </Button>
  );
};

const Preview: React.FC<{ video: AdminVideo }> = ({ video }) => (
  <div className="overflow-hidden rounded-xl bg-black">
    <I18nProvider locale="vi">
      <VideoPlayer>
        <VideoSkin className="aspect-video w-full" style={{ "--media-border-radius": "0" } as CSSProperties}>
          <HlsJsVideo key={video.hlsUrl} src={video.hlsUrl!} playsInline fallback={null}>
            {video.subtitles.map((s) => (
              <track key={s.id} kind="subtitles" src={s.url} srcLang={s.lang} label={s.label} default={s.isDefault} />
            ))}
            {video.storyboardUrl && <track kind="metadata" label="thumbnails" src={video.storyboardUrl} default />}
          </HlsJsVideo>
          <CaptureButton videoId={video.id} />
        </VideoSkin>
      </VideoPlayer>
    </I18nProvider>
  </div>
);

/** Lưới khung hình: chọn làm poster / ảnh nền / ảnh tập. */
const FramesGallery: React.FC<{ video: AdminVideo; target: FrameTarget }> = ({ video, target }) => {
  const { run, pending } = useAdminAction();
  const best = [...video.frames].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

  const actions =
    target.kind === "movie"
      ? [
          { key: "poster", label: "Làm poster (cắt dọc 2:3)", icon: "mdi:image-frame" },
          { key: "backdrop", label: "Làm ảnh nền (16:9)", icon: "mdi:panorama" },
        ]
      : [
          { key: "still", label: "Làm ảnh tập", icon: "mdi:image" },
          { key: "poster", label: "Làm poster phim bộ", icon: "mdi:image-frame" },
          { key: "backdrop", label: "Làm ảnh nền phim bộ", icon: "mdi:panorama" },
        ];

  const apply = (key: string, path: string) => {
    if (key === "delete") return run(() => deleteFrame(video.id, path));
    if (key === "still" && target.kind === "episode") return run(() => setEpisodeStillFromFrame(target.episodeId, path));
    return run(() => setTitleImageFromFrame(target.titleId, key as "poster" | "backdrop", path));
  };

  if (!video.frames.length) return <p className="text-foreground-500 text-sm">Chưa có khung hình.</p>;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {video.frames.map((frame) => (
        <Dropdown key={frame.path}>
          <DropdownTrigger>
            <button
              type="button"
              disabled={pending}
              className="group hover:ring-primary relative aspect-video overflow-hidden rounded-lg ring-2 ring-transparent transition"
            >
              <img src={frame.url} alt="" loading="lazy" className="size-full object-cover transition group-hover:scale-105" />
              <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 text-[10px] text-white">
                {formatClock(frame.time)}
              </span>
              {frame.path === best?.path && (
                <Tooltip content="Khung được chọn tự động">
                  <span className="bg-warning absolute top-1 right-1 rounded px-1 text-[10px] font-bold text-black">★</span>
                </Tooltip>
              )}
              {frame.custom && (
                <span className="bg-secondary absolute top-1 left-1 rounded px-1 text-[10px] text-white">Tự chụp</span>
              )}
            </button>
          </DropdownTrigger>
          <DropdownMenu aria-label="Dùng khung hình" onAction={(key) => apply(String(key), frame.path)}>
            {[
              ...actions.map((a) => (
                <DropdownItem key={a.key} startContent={<Icon icon={a.icon} fontSize={18} />}>
                  {a.label}
                </DropdownItem>
              )),
              <DropdownItem key="delete" color="danger" className="text-danger" startContent={<Icon icon="mdi:delete" fontSize={18} />}>
                Xoá khung hình
              </DropdownItem>,
            ]}
          </DropdownMenu>
        </Dropdown>
      ))}
    </div>
  );
};

const SubtitlesManager: React.FC<{ video: AdminVideo }> = ({ video }) => {
  const { run, pending } = useAdminAction();
  const [file, setFile] = useState<File | null>(null);
  const [lang, setLang] = useState("vi");
  const [label, setLabel] = useState("");

  const upload = () => {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    form.set("lang", lang);
    form.set("label", label);
    run(() => uploadSubtitle(video.id, form), {
      onSuccess: () => {
        setFile(null);
        setLabel("");
      },
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {video.subtitles.length ? (
        <div className="flex flex-col gap-2">
          {video.subtitles.map((s) => (
            <div key={s.id} className="bg-default-100 flex items-center justify-between gap-2 rounded-lg px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <Chip size="sm" variant="flat">
                  {s.lang.toUpperCase()}
                </Chip>
                <span className="truncate text-sm">{s.label}</span>
                {s.isDefault && (
                  <Chip size="sm" color="success" variant="flat">
                    Mặc định
                  </Chip>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <Tooltip content={s.isDefault ? "Bỏ mặc định" : "Bật sẵn khi xem"}>
                  <Button isIconOnly size="sm" variant="light" onPress={() => run(() => setDefaultSubtitle(s.id))}>
                    <Icon icon={s.isDefault ? "mdi:star" : "mdi:star-outline"} fontSize={18} />
                  </Button>
                </Tooltip>
                <Button as="a" href={s.url} target="_blank" isIconOnly size="sm" variant="light">
                  <Icon icon="mdi:eye-outline" fontSize={18} />
                </Button>
                <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => confirm(`Xoá phụ đề ${s.label}?`) && run(() => deleteSubtitle(s.id))}>
                  <Icon icon="mdi:delete-outline" fontSize={18} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-foreground-500 text-sm">Chưa có phụ đề. Phụ đề có sẵn trong file MKV sẽ được trích tự động.</p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <Button as="label" size="sm" variant="flat" startContent={<Icon icon="mdi:file-document-plus-outline" fontSize={18} />}>
          {file ? file.name : "Chọn file .srt/.vtt/.ass"}
          <input type="file" accept=".srt,.vtt,.ass,.ssa" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Button>
        <Select
          size="sm"
          label="Ngôn ngữ"
          className="w-40"
          selectedKeys={[lang]}
          onSelectionChange={(keys) => setLang(String(Array.from(keys)[0] ?? "vi"))}
        >
          {SUBTITLE_LANG_OPTIONS.map((l) => (
            <SelectItem key={l.code}>{l.label}</SelectItem>
          ))}
        </Select>
        <Input size="sm" label="Tên hiển thị (tuỳ chọn)" className="w-48" value={label} onValueChange={setLabel} />
        <Button size="sm" color="primary" isDisabled={!file} isLoading={pending} onPress={upload}>
          Thêm phụ đề
        </Button>
      </div>
    </div>
  );
};

/** Bảng điều khiển đầy đủ cho một video đã upload. */
const VideoPanel: React.FC<{ video: AdminVideo; target: FrameTarget }> = ({ video, target }) => {
  const states = useVideoStatuses([video]);
  const state = states[video.id] ?? video;
  const { run, pending } = useAdminAction();
  const [mode, setMode] = useState(video.mode);
  const active = isActiveVideo(state.status);

  return (
    <div className="flex flex-col gap-4">
      <Card shadow="sm">
        <CardHeader className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold" title={video.originalName}>
              <Icon icon="mdi:file-video" className="mr-1 inline" />
              {video.originalName}
            </p>
            <p className="text-foreground-500 text-xs">
              {formatBytes(video.size)}
              {video.duration ? ` • ${formatClock(video.duration)}` : ""}
              {video.width ? ` • ${video.width}×${video.height}` : ""}
              {video.videoCodec ? ` • ${video.videoCodec}/${video.audioCodec ?? "không tiếng"}` : ""}
              {` • ${video.sourceUrl ? "lấy về" : "tải lên"} ${formatDate(video.createdAt)}`}
            </p>
            {video.sourceUrl && (
              <a href={video.sourceUrl} target="_blank" rel="noreferrer" className="text-primary block truncate text-xs hover:underline">
                <Icon icon="mdi:link-variant" className="mr-1 inline" />
                {video.sourceSite ?? "Nguồn"}: {video.sourceUrl}
              </a>
            )}
            {video.renditions.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {video.renditions.map((r) => (
                  <Chip key={r.name} size="sm" variant="flat" color="primary">
                    {r.name}
                  </Chip>
                ))}
              </div>
            )}
          </div>
          <VideoStatus state={state} />
        </CardHeader>
        <CardBody className="flex flex-col gap-3 pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              size="sm"
              aria-label="Chế độ xử lý"
              className="w-52"
              selectedKeys={[mode]}
              onSelectionChange={(keys) => setMode(String(Array.from(keys)[0] ?? "auto"))}
            >
              {VIDEO_MODES.map((m) => (
                <SelectItem key={m.value} description={m.description}>
                  {m.label}
                </SelectItem>
              ))}
            </Select>
            <Button
              size="sm"
              variant="flat"
              isDisabled={active || (!video.hasSource && !video.sourceUrl)}
              isLoading={pending}
              startContent={<Icon icon="mdi:refresh" fontSize={18} />}
              onPress={() => run(() => reprocessVideo(video.id, mode as "auto" | "copy" | "transcode"))}
            >
              Xử lý lại
            </Button>
            {active && (
              <Button size="sm" variant="flat" color="warning" onPress={() => run(() => cancelVideo(video.id))}>
                Huỷ xử lý
              </Button>
            )}
            <Button size="sm" variant="light" onPress={() => confirm("Gỡ video khỏi phim? (video vẫn nằm trong thư viện)") && run(() => detachVideo(video.id))}>
              Gỡ khỏi phim
            </Button>
            <Button
              size="sm"
              variant="light"
              color="danger"
              onPress={() => confirm("Xoá vĩnh viễn video này và toàn bộ file?") && run(() => deleteVideo(video.id))}
            >
              Xoá video
            </Button>
            <Switch
              size="sm"
              isSelected={video.autoCover}
              onValueChange={(v) => run(() => setAutoCover(video.id, v))}
              className="ml-auto"
            >
              Tự tạo ảnh bìa
            </Switch>
          </div>
          {!video.hasSource && !video.sourceUrl && (
            <p className="text-foreground-500 text-xs">Đã xoá file gốc sau khi xử lý (KEEP_ORIGINALS=false) nên không thể xử lý lại.</p>
          )}
        </CardBody>
      </Card>

      {state.status === "ready" && video.hlsUrl && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card shadow="sm">
            <CardHeader className="font-semibold">Xem thử & chụp ảnh bìa</CardHeader>
            <CardBody className="pt-0">
              <Preview video={video} />
              <p className="text-foreground-500 mt-2 text-xs">
                Tua tới cảnh đẹp rồi bấm “Chụp khung hình”, sau đó chọn khung hình bên cạnh để làm ảnh bìa.
              </p>
            </CardBody>
          </Card>
          <Card shadow="sm">
            <CardHeader className="font-semibold">Khung hình làm ảnh bìa</CardHeader>
            <CardBody className="pt-0">
              <FramesGallery video={video} target={target} />
              <p className="text-foreground-500 mt-2 text-xs">Bấm vào khung hình để dùng làm poster / ảnh nền.</p>
            </CardBody>
          </Card>
        </div>
      )}

      <Card shadow="sm">
        <CardHeader className="font-semibold">Phụ đề</CardHeader>
        <CardBody className="pt-0">
          <SubtitlesManager video={video} />
        </CardBody>
      </Card>
    </div>
  );
};

export default VideoPanel;
