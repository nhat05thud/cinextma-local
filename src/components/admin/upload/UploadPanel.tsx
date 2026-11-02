"use client";

import { useState } from "react";
import { Button, Card, CardBody, CardHeader, Chip, Progress, ScrollShadow, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { formatBytes } from "@/lib/format";
import { useUploads, type UploadItem } from "./UploadManager";

const STATUS: Record<UploadItem["status"], { label: string; color: "default" | "primary" | "success" | "danger" | "warning" }> = {
  queued: { label: "Chờ", color: "default" },
  uploading: { label: "Đang tải", color: "primary" },
  paused: { label: "Tạm dừng", color: "warning" },
  done: { label: "Xong", color: "success" },
  error: { label: "Lỗi", color: "danger" },
};

const eta = (item: UploadItem) => {
  if (item.status !== "uploading" || item.speed <= 0) return "";
  const seconds = (item.file.size - item.bytesUploaded) / item.speed;
  if (seconds < 60) return `còn ${Math.ceil(seconds)} giây`;
  return `còn ${Math.ceil(seconds / 60)} phút`;
};

/** Bảng tiến độ upload nổi ở góc phải dưới trang admin. */
const UploadPanel: React.FC = () => {
  const { items, pause, resume, cancel, clearFinished } = useUploads();
  const [collapsed, setCollapsed] = useState(false);
  if (!items.length) return null;

  const active = items.filter((i) => i.status === "uploading" || i.status === "queued").length;
  const overall = items.reduce((sum, i) => sum + i.progress, 0) / items.length;

  return (
    <Card className="fixed right-4 bottom-4 z-50 w-[min(420px,calc(100vw-2rem))] shadow-2xl" shadow="lg">
      <CardHeader className="flex items-center justify-between gap-2 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon icon="mdi:cloud-upload" className="text-primary shrink-0" fontSize={22} />
          <p className="truncate font-semibold">
            {active ? `Đang tải lên ${active} file` : "Đã tải lên xong"} • {Math.round(overall)}%
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          {items.some((i) => i.status === "done") && (
            <Tooltip content="Xoá các mục đã xong">
              <Button isIconOnly size="sm" variant="light" onPress={clearFinished}>
                <Icon icon="mdi:broom" fontSize={18} />
              </Button>
            </Tooltip>
          )}
          <Button isIconOnly size="sm" variant="light" onPress={() => setCollapsed((c) => !c)}>
            <Icon icon={collapsed ? "mdi:chevron-up" : "mdi:chevron-down"} fontSize={20} />
          </Button>
        </div>
      </CardHeader>
      {!collapsed && (
        <CardBody className="pt-0">
          <ScrollShadow className="max-h-80 space-y-3 pr-1">
            {items.map((item) => (
              <div key={item.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={item.label}>
                      {item.label}
                    </p>
                    <p className="text-foreground-500 truncate text-xs" title={item.file.name}>
                      {item.file.name} • {formatBytes(item.file.size)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Chip size="sm" variant="flat" color={STATUS[item.status].color}>
                      {STATUS[item.status].label}
                    </Chip>
                    {item.status === "uploading" && (
                      <Button isIconOnly size="sm" variant="light" onPress={() => pause(item.id)} aria-label="Tạm dừng">
                        <Icon icon="mdi:pause" fontSize={18} />
                      </Button>
                    )}
                    {(item.status === "paused" || item.status === "error") && (
                      <Button isIconOnly size="sm" variant="light" onPress={() => resume(item.id)} aria-label="Tiếp tục">
                        <Icon icon="mdi:play" fontSize={18} />
                      </Button>
                    )}
                    {item.status !== "done" && (
                      <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => cancel(item.id)} aria-label="Huỷ">
                        <Icon icon="mdi:close" fontSize={18} />
                      </Button>
                    )}
                  </div>
                </div>
                <Progress
                  size="sm"
                  aria-label="Tiến độ"
                  value={item.progress}
                  color={item.status === "error" ? "danger" : item.status === "done" ? "success" : "primary"}
                />
                <p className="text-foreground-500 text-xs">
                  {item.status === "error"
                    ? item.error
                    : item.status === "uploading"
                      ? `${formatBytes(item.bytesUploaded)} / ${formatBytes(item.file.size)} • ${formatBytes(item.speed)}/s ${eta(item)}`
                      : item.status === "done"
                        ? "Đã tải lên, máy chủ đang xử lý video"
                        : ""}
                </p>
              </div>
            ))}
          </ScrollShadow>
        </CardBody>
      )}
    </Card>
  );
};

export default UploadPanel;
