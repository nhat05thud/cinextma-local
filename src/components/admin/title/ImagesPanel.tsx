"use client";

import { useRef } from "react";
import { Button, Card, CardBody, CardHeader } from "@heroui/react";
import { Icon } from "@iconify/react";
import { removeTitleImage, uploadTitleImage } from "@/actions/admin/titles";
import { cn } from "@/utils/helpers";
import { useAdminAction } from "../hooks";

type Kind = "poster" | "backdrop" | "logo";

const SLOTS: { kind: Kind; label: string; hint: string; aspect: string }[] = [
  { kind: "poster", label: "Poster", hint: "Ảnh dọc 2:3 — hiện ở thẻ phim", aspect: "aspect-2/3 w-40" },
  { kind: "backdrop", label: "Ảnh nền (backdrop)", hint: "Ảnh ngang 16:9 — banner trang chủ & trang chi tiết", aspect: "aspect-video w-full max-w-md" },
  { kind: "logo", label: "Logo tên phim", hint: "PNG nền trong suốt (tuỳ chọn)", aspect: "aspect-video w-56 bg-[repeating-conic-gradient(#8882_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]" },
];

const ImageSlot: React.FC<{ titleId: string; kind: Kind; label: string; hint: string; aspect: string; url: string | null }> = ({
  titleId,
  kind,
  label,
  hint,
  aspect,
  url,
}) => {
  const input = useRef<HTMLInputElement>(null);
  const { run, pending } = useAdminAction();

  const upload = (file: File | undefined) => {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    run(() => uploadTitleImage(titleId, kind, form));
  };

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-foreground-500 text-xs">{hint}</p>
      </div>
      <div
        className={cn(
          "border-default-300 bg-default-100 relative flex items-center justify-center overflow-hidden rounded-xl border-2 border-dashed",
          aspect,
        )}
      >
        {url ? (
          <img src={url} alt={label} className={cn("size-full", kind === "logo" ? "object-contain p-2" : "object-cover")} />
        ) : (
          <Icon icon="mdi:image-off-outline" fontSize={32} className="text-foreground-400" />
        )}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="flat" isLoading={pending} onPress={() => input.current?.click()} startContent={<Icon icon="mdi:upload" fontSize={16} />}>
          Tải ảnh lên
        </Button>
        {url && (
          <Button size="sm" variant="light" color="danger" onPress={() => run(() => removeTitleImage(titleId, kind))}>
            Xoá
          </Button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
    </div>
  );
};

const ImagesPanel: React.FC<{ titleId: string; images: Record<Kind, string | null>; hasFrames: boolean }> = ({
  titleId,
  images,
  hasFrames,
}) => (
  <Card shadow="sm">
    <CardHeader className="flex flex-col items-start gap-1">
      <p className="font-semibold">Ảnh bìa</p>
      <p className="text-foreground-500 text-sm">
        Có 2 cách: <b>tải ảnh lên</b> ở đây, hoặc <b>tạo từ video</b> — {hasFrames ? "mở tab Video/Tập phim, bấm vào một khung hình và chọn “Làm poster / Làm ảnh nền”." : "sau khi upload video, hệ thống tự tạo ảnh bìa từ khung hình đẹp nhất (nếu ô ảnh còn trống)."}
      </p>
    </CardHeader>
    <CardBody className="flex flex-wrap gap-6 pt-0">
      {SLOTS.map((slot) => (
        <ImageSlot key={slot.kind} titleId={titleId} url={images[slot.kind]} {...slot} />
      ))}
    </CardBody>
  </Card>
);

export default ImagesPanel;
