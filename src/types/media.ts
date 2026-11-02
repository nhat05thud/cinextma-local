export type VideoFrame = {
  /** Đường dẫn tương đối trong thư mục public media */
  path: string;
  /** Giây trong video */
  time: number;
  score?: number;
  /** Do admin chụp thủ công */
  custom?: boolean;
  /** Admin đã chọn làm khung mặc định */
  selected?: boolean;
};

export type VideoRendition = {
  name: string;
  width: number;
  height: number;
  bandwidth: number;
};

export type VideoStatus = "download_queued" | "downloading" | "queued" | "processing" | "ready" | "failed";

/** Các trạng thái còn đang chạy (chờ tải / đang tải / chờ xử lý / đang xử lý). */
export const ACTIVE_VIDEO_STATUSES = ["download_queued", "downloading", "queued", "processing"];
export const isActiveVideo = (status: string) => ACTIVE_VIDEO_STATUSES.includes(status);
export type VideoMode = "auto" | "copy" | "transcode";
