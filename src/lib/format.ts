import { formatDistanceToNowStrict } from "date-fns";
import { vi } from "date-fns/locale";

/** 135 -> "2 giờ 15 phút" */
export const formatRuntime = (minutes: number | null | undefined) => {
  if (!minutes || minutes <= 0) return "Đang cập nhật";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} phút`;
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
};

/** 3725 -> "1:02:05" */
export const formatClock = (seconds: number | null | undefined) => {
  const total = Math.max(0, Math.floor(seconds ?? 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
};

export const timeAgo = (date: string | Date) =>
  formatDistanceToNowStrict(new Date(date), { addSuffix: true, locale: vi });

export const formatDate = (date: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions) => {
  if (!date) return "";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", options ?? { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed);
};

export const formatBytes = (bytes: number | bigint | null | undefined) => {
  let value = Number(bytes ?? 0);
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
};

export const formatCount = (value: number) => new Intl.NumberFormat("vi-VN", { notation: "compact" }).format(value);
