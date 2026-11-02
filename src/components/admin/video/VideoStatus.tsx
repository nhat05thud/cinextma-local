"use client";

import { Chip, Progress, Tooltip } from "@heroui/react";
import type { VideoState } from "../hooks";
import { isActiveVideo } from "@/types/media";

export const STAGE_LABELS: Record<string, string> = {
  download: "Tải từ nguồn",
  probe: "Phân tích file",
  covers: "Tạo ảnh bìa",
  subtitles: "Trích phụ đề",
  storyboard: "Tạo ảnh xem trước",
  transcode: "Chuyển mã HLS",
  done: "Hoàn tất",
};

export const STATUS_LABELS = {
  download_queued: { label: "Chờ tải về", color: "default" },
  downloading: { label: "Đang tải về", color: "primary" },
  queued: { label: "Chờ xử lý", color: "default" },
  processing: { label: "Đang xử lý", color: "warning" },
  ready: { label: "Sẵn sàng", color: "success" },
  failed: { label: "Lỗi", color: "danger" },
} as const;

/** Chip trạng thái + thanh tiến độ của một video. */
const VideoStatus: React.FC<{ state: VideoState; compact?: boolean }> = ({ state, compact }) => {
  const meta = STATUS_LABELS[state.status as keyof typeof STATUS_LABELS] ?? STATUS_LABELS.queued;
  const active = isActiveVideo(state.status);
  const running = state.status === "processing" || state.status === "downloading";

  const chip = (
    <Chip size="sm" variant="flat" color={meta.color}>
      {meta.label}
      {running ? ` ${Math.round(state.progress)}%` : ""}
    </Chip>
  );

  if (compact) {
    return state.status === "failed" && state.error ? <Tooltip content={state.error}>{chip}</Tooltip> : chip;
  }

  return (
    <div className="flex min-w-48 flex-col gap-1">
      <div className="flex items-center gap-2">
        {chip}
        {running && state.stage && (
          <span className="text-foreground-500 text-xs">{STAGE_LABELS[state.stage] ?? state.stage}</span>
        )}
      </div>
      {active && (
        <Progress
          size="sm"
          aria-label="Tiến độ xử lý"
          isIndeterminate={!running}
          value={state.progress}
          color={state.status === "downloading" ? "primary" : "warning"}
        />
      )}
      {state.status === "failed" && state.error && (
        <p className="text-danger line-clamp-3 text-xs" title={state.error}>
          {state.error}
        </p>
      )}
    </div>
  );
};

export default VideoStatus;
