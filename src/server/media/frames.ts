import type { VideoFrame } from "@/types/media";

export const parseFrames = (json: string | null | undefined): VideoFrame[] => {
  try {
    return json ? (JSON.parse(json) as VideoFrame[]) : [];
  } catch {
    return [];
  }
};

/** Khung admin đã chọn, hoặc khung có điểm cao nhất. */
export const bestFrame = (frames: VideoFrame[]) =>
  frames.find((f) => f.selected) ?? [...frames].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
