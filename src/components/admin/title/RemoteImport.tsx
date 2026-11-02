"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addToast,
  Button,
  Checkbox,
  Chip,
  Image,
  Input,
  Radio,
  RadioGroup,
  ScrollShadow,
  Select,
  SelectItem,
  Spinner,
  Textarea,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { analyzeRemoteUrl, importRemote } from "@/actions/admin/remote";
import { VIDEO_MODES } from "@/lib/catalog";
import { formatClock } from "@/lib/format";
import type { RemoteInfo } from "@/server/media/remote";

const QUALITIES = [
  { key: "auto", label: "Tự động (H.264, xử lý nhanh)", description: "Thường tối đa 1080p, đóng gói HLS trong vài giây" },
  { key: "best", label: "Cao nhất (có thể 4K)", description: "Thường là VP9/AV1, phải chuyển mã nên chậm" },
  { key: "1080", label: "Tối đa 1080p", description: "" },
  { key: "720", label: "Tối đa 720p", description: "Tiết kiệm dung lượng" },
  { key: "480", label: "Tối đa 480p", description: "Nhẹ nhất" },
];

const SITE_ICONS: Record<string, string> = {
  youtube: "mdi:youtube",
  youtubetab: "mdi:youtube",
  vimeo: "mdi:vimeo",
  facebook: "mdi:facebook",
  archiveorg: "mdi:bank",
  generic: "mdi:link-variant",
};

type Target = { titleId: string; type: "movie" | "tv"; title: string };
type Kind = "movie" | "tv" | "movies";

interface RemoteImportProps {
  /** Lấy video cho phim có sẵn (thay video phim lẻ / thêm tập phim bộ) */
  target?: Target;
  onDone?: () => void;
}

/**
 * Dán link -> nhận diện website -> chọn video -> tải về server -> xử lý HLS như video upload.
 */
const RemoteImport: React.FC<RemoteImportProps> = ({ target, onDone }) => {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [info, setInfo] = useState<RemoteInfo | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [kind, setKind] = useState<Kind>("movie");
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [overview, setOverview] = useState("");
  const [entries, setEntries] = useState<(RemoteInfo["entries"][number] & { selected: boolean })[]>([]);
  const [quality, setQuality] = useState("auto");
  const [cover, setCover] = useState<"source" | "auto" | "none">("source");
  const [subtitles, setSubtitles] = useState(true);
  const [mode, setMode] = useState("auto");

  const effectiveKind: Kind = target ? target.type : kind;
  const selected = entries.filter((e) => e.selected);

  const analyze = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!url.trim()) return;
    setAnalyzing(true);
    setError(null);
    setInfo(null);
    const result = await analyzeRemoteUrl(url);
    setAnalyzing(false);
    if (!result.success || !result.data) {
      setError(result.message ?? "Không đọc được link này");
      return;
    }
    const data = result.data;
    setInfo(data);
    setTitle(data.title);
    setYear(data.year ? String(data.year) : "");
    setOverview(data.description ?? "");
    setKind(data.isPlaylist ? "tv" : "movie");
    setCover(data.thumbnail || data.entries.some((e) => e.thumbnail) ? "source" : "auto");
    // Phim lẻ có sẵn: mặc định chọn video đầu tiên; còn lại chọn tất cả
    setEntries(data.entries.map((e, i) => ({ ...e, selected: target?.type === "movie" ? i === 0 : true })));
  };

  const duplicates = useMemo(() => {
    if (effectiveKind !== "tv") return new Set<string>();
    const keys = selected.map((e) => `${e.season}-${e.episode}`);
    return new Set(keys.filter((k, i) => keys.indexOf(k) !== i));
  }, [selected, effectiveKind]);

  const problem =
    !selected.length
      ? "Chọn ít nhất 1 video"
      : effectiveKind === "movie" && selected.length > 1
        ? "Phim lẻ chỉ lấy 1 video — bỏ bớt hoặc chọn loại khác"
        : duplicates.size
          ? "Có tập bị trùng số"
          : !target && effectiveKind !== "movies" && !title.trim()
            ? "Nhập tên phim"
            : null;

  const submit = async () => {
    if (!info || problem) return;
    setSubmitting(true);
    const result = await importRemote({
      site: info.site,
      target: target
        ? { kind: "existing", titleId: target.titleId }
        : kind === "movies"
          ? { kind: "movies" }
          : { kind: "new", type: kind, title, year: year ? Number(year) : null, overview },
      items: selected.map(({ url, title, season, episode, thumbnail }) => ({ url, title, season, episode, thumbnail })),
      thumbnail: info.thumbnail ?? selected[0]?.thumbnail ?? null,
      quality,
      cover,
      subtitles,
      mode,
    });
    setSubmitting(false);
    addToast({ title: result.message, color: result.success ? "success" : "danger" });
    if (!result.success || !result.data) return;
    if (onDone) {
      onDone();
      router.refresh();
    } else {
      // Mở đúng tab có thanh tiến độ tải / xử lý
      router.push(kind === "movies" ? "/admin/videos?filter=active" : `/admin/titles/${result.data.titleId}?tab=${kind === "tv" ? "episodes" : "video"}`);
    }
  };

  const setEntry = (index: number, patch: Partial<(typeof entries)[number]>) =>
    setEntries((all) => all.map((e, i) => (i === index ? { ...e, ...patch } : e)));

  return (
    <div className="flex flex-col gap-4">
      <form className="flex gap-2" onSubmit={analyze}>
        <Input
          value={url}
          onValueChange={setUrl}
          placeholder="Dán link video hoặc playlist (YouTube, Vimeo, Facebook, archive.org, link .mp4/.m3u8...)"
          startContent={<Icon icon="mdi:link-variant" fontSize={20} />}
          isClearable
          onClear={() => setUrl("")}
          autoFocus={!target}
        />
        <Button type="submit" color="primary" isLoading={analyzing} isDisabled={!url.trim()}>
          Phân tích
        </Button>
      </form>

      {analyzing && (
        <div className="text-foreground-500 flex items-center gap-2 text-sm">
          <Spinner size="sm" /> Đang đọc trang, có thể mất 10–30 giây...
        </div>
      )}
      {error && (
        <div className="bg-danger-50 text-danger rounded-xl p-3 text-sm">
          <Icon icon="mdi:alert-circle" className="mr-1 inline" />
          {error}
        </div>
      )}

      {info && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 md:flex-row">
            {info.thumbnail && (
              <Image src={info.thumbnail} alt="" className="aspect-video w-full object-cover md:w-64" radius="md" removeWrapper />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Chip color="primary" variant="flat" startContent={<Icon icon={SITE_ICONS[info.siteKey] ?? "mdi:web"} className="ml-1" />}>
                  {info.site}
                </Chip>
                <Chip variant="flat">{info.isPlaylist ? `Playlist • ${info.entries.length} video` : "1 video"}</Chip>
                {info.duration ? <Chip variant="flat">{formatClock(info.duration)}</Chip> : null}
              </div>

              {target ? (
                <p className="text-sm">
                  Thêm vào <b>{target.title}</b> ({target.type === "tv" ? "các tập phim bộ" : "thay video phim lẻ"})
                </p>
              ) : (
                <>
                  {info.isPlaylist && (
                    <RadioGroup orientation="horizontal" size="sm" label="Nhập thành" value={kind} onValueChange={(v) => setKind(v as Kind)}>
                      <Radio value="tv" description="Các video là các tập của 1 phim">
                        Phim bộ
                      </Radio>
                      <Radio value="movies" description="Mỗi video thành 1 phim riêng">
                        Nhiều phim lẻ
                      </Radio>
                      <Radio value="movie" description="Chỉ chọn 1 video">
                        Phim lẻ
                      </Radio>
                    </RadioGroup>
                  )}
                  {kind !== "movies" && (
                    <div className="flex gap-2">
                      <Input label="Tên phim" value={title} onValueChange={setTitle} isRequired />
                      <Input label="Năm" type="number" className="w-28" value={year} onValueChange={setYear} />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {!target && kind !== "movies" && (
            <Textarea label="Nội dung (lấy từ mô tả trang nguồn, sửa nếu cần)" minRows={2} maxRows={6} value={overview} onValueChange={setOverview} />
          )}

          {(info.isPlaylist || effectiveKind === "tv") && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Chọn video ({selected.length}/{entries.length})
                </p>
                <div className="flex gap-1">
                  <Button size="sm" variant="light" onPress={() => setEntries((all) => all.map((e) => ({ ...e, selected: true })))}>
                    Chọn tất cả
                  </Button>
                  <Button size="sm" variant="light" onPress={() => setEntries((all) => all.map((e) => ({ ...e, selected: false })))}>
                    Bỏ chọn
                  </Button>
                </div>
              </div>
              <ScrollShadow className="flex max-h-96 flex-col gap-1.5 pr-1">
                {entries.map((entry, i) => (
                  <div key={entry.url + i} className="bg-default-100 flex items-center gap-2 rounded-lg p-1.5">
                    <Checkbox isSelected={entry.selected} onValueChange={(v) => setEntry(i, { selected: v })} aria-label="Chọn" />
                    <div className="bg-default-200 aspect-video w-24 shrink-0 overflow-hidden rounded">
                      {entry.thumbnail && <img src={entry.thumbnail} alt="" className="size-full object-cover" loading="lazy" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm" title={entry.title}>
                        {entry.title}
                      </p>
                      {entry.duration ? <p className="text-foreground-500 text-xs">{formatClock(entry.duration)}</p> : null}
                    </div>
                    {effectiveKind === "tv" && (
                      <>
                        <Input
                          size="sm"
                          type="number"
                          aria-label="Phần"
                          startContent={<span className="text-foreground-500 text-xs">P</span>}
                          className="w-20"
                          value={String(entry.season)}
                          onValueChange={(v) => setEntry(i, { season: Number(v) || 1 })}
                        />
                        <Input
                          size="sm"
                          type="number"
                          aria-label="Tập"
                          startContent={<span className="text-foreground-500 text-xs">Tập</span>}
                          className="w-24"
                          isInvalid={entry.selected && duplicates.has(`${entry.season}-${entry.episode}`)}
                          value={String(entry.episode)}
                          onValueChange={(v) => setEntry(i, { episode: Number(v) || 1 })}
                        />
                      </>
                    )}
                  </div>
                ))}
              </ScrollShadow>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <Select label="Chất lượng tải về" selectedKeys={[quality]} onSelectionChange={(k) => setQuality(String(Array.from(k)[0] ?? "auto"))}>
              {QUALITIES.map((q) => (
                <SelectItem key={q.key} description={q.description || undefined}>
                  {q.label}
                </SelectItem>
              ))}
            </Select>
            <Select label="Chế độ xử lý" selectedKeys={[mode]} onSelectionChange={(k) => setMode(String(Array.from(k)[0] ?? "auto"))}>
              {VIDEO_MODES.map((m) => (
                <SelectItem key={m.value} description={m.description}>
                  {m.label}
                </SelectItem>
              ))}
            </Select>
          </div>

          <RadioGroup label="Ảnh bìa" orientation="horizontal" size="sm" value={cover} onValueChange={(v) => setCover(v as typeof cover)}>
            <Radio value="source" description="Thumbnail của video trên trang nguồn">
              Lấy ảnh từ trang nguồn
            </Radio>
            <Radio value="auto" description="Chọn khung hình đẹp nhất sau khi tải">
              Tự tạo từ video
            </Radio>
            <Radio value="none" description="Bạn tự tải ảnh lên sau">
              Không
            </Radio>
          </RadioGroup>
          <Checkbox size="sm" isSelected={subtitles} onValueChange={setSubtitles}>
            Lấy kèm phụ đề tiếng Việt / tiếng Anh (nếu trang nguồn có)
          </Checkbox>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {problem && <span className="text-warning text-sm">{problem}</span>}
            <Button
              color="primary"
              variant="shadow"
              isLoading={submitting}
              isDisabled={!!problem}
              onPress={submit}
              startContent={!submitting && <Icon icon="mdi:cloud-download" fontSize={20} />}
            >
              Lấy về {selected.length > 1 ? `${selected.length} video` : ""}
            </Button>
          </div>
          <p className="text-foreground-500 text-xs">
            Video được tải về máy chủ rồi xử lý như video upload. Theo dõi tiến độ ở mục <b>Video &amp; xử lý</b>. Chỉ lấy nội dung bạn có quyền
            phát; video có DRM không tải được.
          </p>
        </div>
      )}
    </div>
  );
};

export default RemoteImport;
