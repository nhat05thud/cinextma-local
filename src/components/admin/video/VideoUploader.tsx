"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addToast, Button, Radio, RadioGroup } from "@heroui/react";
import { Icon } from "@iconify/react";
import { uploadTitleImage } from "@/actions/admin/titles";
import { uploadEpisodeStill } from "@/actions/admin/episodes";
import { VIDEO_MODES } from "@/lib/catalog";
import { formatBytes } from "@/lib/format";
import { cn } from "@/utils/helpers";
import { useUploads, type UploadTarget } from "../upload/UploadManager";

export const VIDEO_ACCEPT = "video/*,.mkv,.avi,.mov,.m4v,.ts,.wmv,.flv,.mpg,.mpeg,.webm";

type CoverSlot = { key: string; label: string; hint: string };

const COVER_SLOTS: Record<"movie" | "episode", CoverSlot[]> = {
  movie: [
    { key: "poster", label: "Poster (dọc 2:3)", hint: "600×900 trở lên" },
    { key: "backdrop", label: "Ảnh nền (ngang 16:9)", hint: "1920×1080 trở lên" },
  ],
  episode: [{ key: "still", label: "Ảnh tập (ngang 16:9)", hint: "1280×720 trở lên" }],
};

/** Ô chọn ảnh có xem trước. */
export const ImagePick: React.FC<{ label: string; hint?: string; file: File | null; onChange: (f: File | null) => void; aspect: string }> = ({
  label,
  hint,
  file,
  onChange,
  aspect,
}) => {
  const input = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      className={cn(
        "border-default-300 hover:border-primary bg-default-100 relative flex flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 border-dashed p-2 text-center transition-colors",
        aspect,
      )}
    >
      {preview ? (
        <img src={preview} alt={label} className="absolute inset-0 size-full object-cover" />
      ) : (
        <>
          <Icon icon="mdi:image-plus" fontSize={28} className="text-foreground-400" />
          <span className="text-xs font-medium">{label}</span>
          {hint && <span className="text-foreground-400 text-[10px]">{hint}</span>}
        </>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </button>
  );
};

interface VideoUploaderProps {
  kind: "movie" | "episode";
  target: NonNullable<UploadTarget>;
  label: string;
  /** Phim đã có video -> upload mới sẽ thay thế */
  replacing?: boolean;
  onQueued?: () => void;
}

/**
 * Chọn file video + tuỳ chọn xử lý + cách tạo ảnh bìa:
 *  1. Tự tạo ảnh bìa từ khung hình video (mặc định)
 *  2. Tự tải ảnh bìa lên
 */
const VideoUploader: React.FC<VideoUploaderProps> = ({ kind, target, label, replacing, onQueued }) => {
  const { enqueue } = useUploads();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState("auto");
  const [cover, setCover] = useState<"auto" | "upload">("auto");
  const [images, setImages] = useState<Record<string, File | null>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    try {
      if (cover === "upload") {
        for (const slot of COVER_SLOTS[kind]) {
          const image = images[slot.key];
          if (!image) continue;
          const form = new FormData();
          form.set("file", image);
          const result =
            kind === "episode"
              ? await uploadEpisodeStill(target.targetId, form)
              : await uploadTitleImage(target.targetId, slot.key as "poster" | "backdrop", form);
          if (!result.success) throw new Error(result.message);
        }
      }
      enqueue([{ file, label, target, mode, autoCover: cover === "auto" }]);
      addToast({ title: "Đã thêm vào hàng đợi tải lên", color: "primary" });
      setFile(null);
      setImages({});
      onQueued?.();
    } catch (error) {
      addToast({ title: error instanceof Error ? error.message : "Lỗi tải ảnh", color: "danger" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInput.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && fileInput.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) setFile(dropped);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors",
          dragging ? "border-primary bg-primary/10" : "border-default-300 hover:border-primary bg-default-100/50",
        )}
      >
        <Icon icon={file ? "mdi:file-video" : "mdi:cloud-upload-outline"} fontSize={40} className="text-primary" />
        {file ? (
          <>
            <p className="font-semibold break-all">{file.name}</p>
            <p className="text-foreground-500 text-sm">{formatBytes(file.size)} • bấm để đổi file khác</p>
          </>
        ) : (
          <>
            <p className="font-semibold">{replacing ? "Kéo thả video mới để thay thế" : "Kéo thả file video vào đây"}</p>
            <p className="text-foreground-500 text-sm">hoặc bấm để chọn • MP4, MKV, MOV, AVI... (không giới hạn dung lượng)</p>
          </>
        )}
        <input ref={fileInput} type="file" accept={VIDEO_ACCEPT} hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>

      {file && (
        <>
          <RadioGroup label="Chế độ xử lý" value={mode} onValueChange={setMode} size="sm">
            {VIDEO_MODES.map((m) => (
              <Radio key={m.value} value={m.value} description={m.description}>
                {m.label}
              </Radio>
            ))}
          </RadioGroup>

          <RadioGroup
            label="Ảnh bìa"
            orientation="horizontal"
            value={cover}
            onValueChange={(v) => setCover(v as "auto" | "upload")}
            size="sm"
          >
            <Radio value="auto" description="Chọn khung hình đẹp nhất trong video, cắt poster dọc thông minh">
              Tự tạo từ video
            </Radio>
            <Radio value="upload" description="Dùng ảnh bạn có sẵn">
              Tải ảnh bìa lên
            </Radio>
          </RadioGroup>

          {cover === "upload" && (
            <div className="flex flex-wrap items-end gap-3">
              {COVER_SLOTS[kind].map((slot) => (
                <ImagePick
                  key={slot.key}
                  label={slot.label}
                  hint={slot.hint}
                  file={images[slot.key] ?? null}
                  onChange={(f) => setImages((current) => ({ ...current, [slot.key]: f }))}
                  aspect={slot.key === "poster" ? "aspect-2/3 w-28" : "aspect-video w-52"}
                />
              ))}
              <p className="text-foreground-500 basis-full text-xs">
                Ô nào để trống sẽ giữ nguyên ảnh hiện tại. Bạn vẫn có thể chọn ảnh từ khung hình sau khi video xử lý xong.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="light" onPress={() => setFile(null)} isDisabled={busy}>
              Huỷ
            </Button>
            <Button color="primary" variant="shadow" onPress={submit} isLoading={busy} startContent={!busy && <Icon icon="mdi:upload" fontSize={20} />}>
              Tải lên
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default VideoUploader;
