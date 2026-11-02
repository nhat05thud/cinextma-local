"use client";

import { useState } from "react";
import { Button, Card, CardBody, CardHeader, Chip, Input, Textarea } from "@heroui/react";
import { Icon } from "@iconify/react";
import { saveSettings } from "@/actions/admin/manage";
import { updateYtdlpAction } from "@/actions/admin/remote";
import { formatBytes } from "@/lib/format";
import type { SiteSettings } from "@/lib/settings";
import { useAdminAction } from "../hooks";

type SystemInfo = {
  ffmpeg: string;
  ffmpegPath: string;
  encoder: string;
  transcodeHeights: number[];
  mediaRoot: string;
  keepOriginals: boolean;
  workerEnabled: boolean;
  allowSignup: boolean;
  tmdbConfigured: boolean;
  ytdlp: string;
  ytdlpPath: string;
  denoConfigured: boolean;
  disk: { free: number; total: number } | null;
  node: string;
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="border-divider grid grid-cols-[180px_1fr] gap-3 border-b py-2 text-sm last:border-0">
    <span className="text-foreground-500">{label}</span>
    <span className="break-all">{children}</span>
  </div>
);

const SettingsForm: React.FC<{ settings: SiteSettings; system: SystemInfo }> = ({ settings, system }) => {
  const { run, pending } = useAdminAction();
  const updater = useAdminAction();
  const [form, setForm] = useState({ ...settings, homeRowLimit: String(settings.homeRowLimit), tmdbToken: "" });
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = () => {
    const { tmdbToken, ...rest } = form;
    run(() => saveSettings({ ...rest, ...(tmdbToken.trim() ? { tmdbToken } : {}) }), {
      onSuccess: () => setForm((f) => ({ ...f, tmdbToken: "" })),
    });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
      <Card shadow="sm">
        <CardHeader className="font-semibold">Thông tin trang web</CardHeader>
        <CardBody className="flex flex-col gap-4 pt-0">
          <Input label="Tên trang web" value={form.siteName} onValueChange={set("siteName")} description="Hiện ở logo, tiêu đề tab trình duyệt" />
          <Textarea label="Mô tả" value={form.siteDescription} onValueChange={set("siteDescription")} />
          <Input label="Dòng chữ chân trang" value={form.footerText} onValueChange={set("footerText")} />
          <Input type="number" label="Số phim mỗi hàng ở trang chủ" value={form.homeRowLimit} onValueChange={set("homeRowLimit")} className="max-w-xs" />
          <Input
            type="password"
            label="TMDB API Read Access Token"
            placeholder={system.tmdbConfigured ? "•••••••• (đã cấu hình — nhập để thay)" : "eyJhbGciOiJIUzI1NiJ9..."}
            value={form.tmdbToken}
            onValueChange={set("tmdbToken")}
            description="Lấy miễn phí tại themoviedb.org → Settings → API. Dùng cho tính năng import thông tin phim."
          />
          <Button color="primary" variant="shadow" className="self-end" isLoading={pending} onPress={save} startContent={!pending && <Icon icon="mdi:content-save" />}>
            Lưu cài đặt
          </Button>
        </CardBody>
      </Card>

      <Card shadow="sm">
        <CardHeader className="flex flex-col items-start">
          <p className="font-semibold">Hệ thống</p>
          <p className="text-foreground-500 text-xs">Đổi các giá trị này trong file .env rồi khởi động lại dịch vụ.</p>
        </CardHeader>
        <CardBody className="pt-0">
          <Row label="ffmpeg">
            {system.ffmpeg.startsWith("Lỗi") ? <Chip color="danger" size="sm">{system.ffmpeg}</Chip> : system.ffmpeg}
          </Row>
          <Row label="FFMPEG_PATH">{system.ffmpegPath}</Row>
          <Row label="Bộ mã hoá (VIDEO_ENCODER)">{system.encoder}</Row>
          <Row label="Mức chất lượng transcode">{system.transcodeHeights.map((h) => `${h}p`).join(", ")}</Row>
          <Row label="Thư mục media">{system.mediaRoot}</Row>
          <Row label="Dung lượng trống">
            {system.disk ? `${formatBytes(system.disk.free)} / ${formatBytes(system.disk.total)}` : "Không xác định"}
          </Row>
          <Row label="Giữ file gốc">{system.keepOriginals ? "Có" : "Không"}</Row>
          <Row label="Worker trong web server">{system.workerEnabled ? "Bật" : "Tắt (chạy riêng)"}</Row>
          <Row label="Cho phép đăng ký">{system.allowSignup ? "Có" : "Không"}</Row>
          <Row label="TMDB">{system.tmdbConfigured ? <Chip size="sm" color="success" variant="flat">Đã cấu hình</Chip> : <Chip size="sm" variant="flat">Chưa cấu hình</Chip>}</Row>
          <Row label="yt-dlp (lấy từ link)">
            <span className="flex flex-wrap items-center gap-2">
              {system.ytdlp.startsWith("Lỗi") ? <Chip color="danger" size="sm">{system.ytdlp}</Chip> : system.ytdlp}
              <Button size="sm" variant="flat" isLoading={updater.pending} onPress={() => updater.run(updateYtdlpAction)}>
                Cập nhật
              </Button>
            </span>
          </Row>
          <Row label="Deno (cho YouTube)">
            {system.denoConfigured ? <Chip size="sm" color="success" variant="flat">Đã cấu hình</Chip> : <Chip size="sm" color="warning" variant="flat">Chưa cấu hình DENO_PATH</Chip>}
          </Row>
          <Row label="Node.js">{system.node}</Row>
        </CardBody>
      </Card>
    </div>
  );
};

export default SettingsForm;
