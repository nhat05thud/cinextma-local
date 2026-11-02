"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addToast, Button, Card, CardBody, CardHeader, Input, Radio, RadioGroup, Tab, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import { createTitle, importFromTmdb } from "@/actions/admin/titles";
import { VIDEO_MODES } from "@/lib/catalog";
import { formatBytes } from "@/lib/format";
import { useUploads } from "../upload/UploadManager";
import { VIDEO_ACCEPT } from "../video/VideoUploader";
import TmdbSearch from "./TmdbSearch";
import RemoteImport from "./RemoteImport";
import { parseMovieFileName } from "@/lib/filename";

const TypePicker: React.FC<{ value: "movie" | "tv"; onChange: (v: "movie" | "tv") => void }> = ({ value, onChange }) => (
  <RadioGroup orientation="horizontal" value={value} onValueChange={(v) => onChange(v as "movie" | "tv")} label="Loại phim">
    <Radio value="movie" description="Một video duy nhất">
      Phim lẻ
    </Radio>
    <Radio value="tv" description="Nhiều phần, nhiều tập">
      Phim bộ
    </Radio>
  </RadioGroup>
);

const ManualCreate: React.FC = () => {
  const router = useRouter();
  const [type, setType] = useState<"movie" | "tv">("movie");
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const result = await createTitle({ type, title, year: year ? Number(year) : null });
    setBusy(false);
    if (!result.success || !result.data) return addToast({ title: result.message, color: "danger" });
    router.push(`/admin/titles/${result.data.id}?tab=${type === "tv" ? "episodes" : "video"}`);
  };

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <TypePicker value={type} onChange={setType} />
      <div className="flex gap-3">
        <Input isRequired label="Tên phim" value={title} onValueChange={setTitle} autoFocus />
        <Input type="number" label="Năm" className="w-32" value={year} onValueChange={setYear} />
      </div>
      <Button color="primary" variant="shadow" className="self-start" isDisabled={!title.trim()} isLoading={busy} onPress={submit}>
        Tạo và tiếp tục
      </Button>
    </div>
  );
};

const TmdbImport: React.FC = () => {
  const router = useRouter();
  const [type, setType] = useState<"movie" | "tv">("movie");
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <TypePicker value={type} onChange={setType} />
      <TmdbSearch
        key={type}
        type={type}
        actionLabel="Import"
        onPick={async (item) => {
          const result = await importFromTmdb(item.id, type);
          addToast({ title: result.message, color: result.success ? "success" : "danger" });
          if (result.success && result.data) router.push(`/admin/titles/${result.data.id}?tab=${type === "tv" ? "episodes" : "video"}`);
        }}
      />
      <p className="text-foreground-500 text-xs">
        Import sẽ tải về poster, ảnh nền, logo, diễn viên, trailer{type === "tv" ? ", danh sách phần và tập" : ""}. Phim được tạo ở dạng bản nháp để bạn upload video trước khi xuất bản.
      </p>
    </div>
  );
};

/** Kéo thả 1 hoặc nhiều file phim: mỗi file thành 1 phim lẻ, tên lấy từ tên file, upload tự chạy. */
const QuickFromVideo: React.FC = () => {
  const router = useRouter();
  const { enqueue } = useUploads();
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<{ file: File; title: string; year: string }[]>([]);
  const [mode, setMode] = useState("auto");
  const [busy, setBusy] = useState(false);

  const pick = (files: FileList | null) => {
    if (!files) return;
    setRows(Array.from(files).map((file) => {
      const parsed = parseMovieFileName(file.name);
      return { file, title: parsed.title, year: parsed.year?.toString() ?? "" };
    }));
  };

  const start = async () => {
    setBusy(true);
    let created = 0;
    for (const row of rows) {
      const result = await createTitle({ type: "movie", title: row.title, year: row.year ? Number(row.year) : null });
      if (!result.success || !result.data) {
        addToast({ title: `${row.title}: ${result.message}`, color: "danger" });
        continue;
      }
      enqueue([{ file: row.file, label: row.title, target: { targetType: "title", targetId: result.data.id }, mode, autoCover: true }]);
      created++;
    }
    setBusy(false);
    addToast({ title: `Đã tạo ${created} phim, video đang được tải lên`, color: "success" });
    router.push("/admin/titles?status=draft");
  };

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p className="text-foreground-500 text-sm">
        Chọn một hoặc nhiều file phim. Mỗi file sẽ thành một phim lẻ (bản nháp), tên phim và năm được đoán từ tên file,
        <b> ảnh bìa tự tạo từ video</b>. Sau đó bạn có thể bấm “Lấy thông tin từ TMDB” để điền nội dung và diễn viên.
      </p>
      <Button
        variant="flat"
        color="primary"
        className="self-start"
        startContent={<Icon icon="mdi:file-video-outline" fontSize={20} />}
        onPress={() => input.current?.click()}
      >
        Chọn file phim
      </Button>
      <input ref={input} type="file" accept={VIDEO_ACCEPT} multiple hidden onChange={(e) => pick(e.target.files)} />
      {rows.length > 0 && (
        <>
          <div className="flex flex-col gap-2">
            {rows.map((row, i) => (
              <div key={row.file.name + i} className="bg-default-100 flex flex-wrap items-center gap-2 rounded-xl p-2">
                <div className="w-full min-w-0 sm:w-56">
                  <p className="truncate text-xs" title={row.file.name}>
                    {row.file.name}
                  </p>
                  <p className="text-foreground-500 text-xs">{formatBytes(row.file.size)}</p>
                </div>
                <Input
                  size="sm"
                  label="Tên phim"
                  className="min-w-48 flex-1"
                  value={row.title}
                  onValueChange={(v) => setRows((all) => all.map((r, j) => (j === i ? { ...r, title: v } : r)))}
                />
                <Input
                  size="sm"
                  type="number"
                  label="Năm"
                  className="w-24"
                  value={row.year}
                  onValueChange={(v) => setRows((all) => all.map((r, j) => (j === i ? { ...r, year: v } : r)))}
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
          <Button
            color="primary"
            variant="shadow"
            className="self-start"
            isLoading={busy}
            isDisabled={rows.some((r) => !r.title.trim())}
            onPress={start}
            startContent={!busy && <Icon icon="mdi:upload" fontSize={20} />}
          >
            Tạo {rows.length} phim và tải lên
          </Button>
        </>
      )}
    </div>
  );
};

const NewTitle: React.FC<{ tmdbConfigured: boolean }> = ({ tmdbConfigured }) => (
  <Card shadow="sm">
    <CardHeader className="flex flex-col items-start">
      <h1 className="text-2xl font-bold">Thêm phim mới</h1>
    </CardHeader>
    <CardBody>
      <Tabs variant="bordered" color="primary" defaultSelectedKey="remote">
        <Tab key="remote" title={<span className="flex items-center gap-2"><Icon icon="mdi:cloud-download" />Lấy từ link</span>}>
          <RemoteImport />
        </Tab>
        <Tab key="video" title={<span className="flex items-center gap-2"><Icon icon="mdi:lightning-bolt" />Tạo nhanh từ file video</span>}>
          <QuickFromVideo />
        </Tab>
        <Tab key="tmdb" title={<span className="flex items-center gap-2"><Icon icon="simple-icons:themoviedatabase" />Import từ TMDB</span>}>
          {tmdbConfigured ? (
            <TmdbImport />
          ) : (
            <p className="text-foreground-500">
              Chưa cấu hình TMDB token. Vào <b>Cài đặt</b> để nhập token miễn phí từ themoviedb.org (Settings → API → API Read Access Token).
            </p>
          )}
        </Tab>
        <Tab key="manual" title={<span className="flex items-center gap-2"><Icon icon="mdi:pencil" />Nhập thủ công</span>}>
          <ManualCreate />
        </Tab>
      </Tabs>
    </CardBody>
  </Card>
);

export default NewTitle;
