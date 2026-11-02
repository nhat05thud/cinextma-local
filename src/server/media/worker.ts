import { prisma } from "../db";
import { ensureStorageDirs } from "../storage";
import { JobCancelledError, processVideo } from "./pipeline";
import { downloadRemoteVideo } from "./remote";

const POLL_INTERVAL_MS = 3000;

const globalForWorker = globalThis as unknown as { cinextmaWorker?: { wake: () => void } };

/** Nhận job kế tiếp một cách nguyên tử (an toàn khi có nhiều worker). */
const claim = async (from: string, to: string, stage: string, extraWhere = {}) => {
  const next = await prisma.video.findFirst({
    where: { status: from, ...extraWhere },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!next) return null;
  const { count } = await prisma.video.updateMany({
    where: { id: next.id, status: from },
    data: { status: to, stage, progress: 0, error: null, startedAt: new Date(), finishedAt: null, attempts: { increment: 1 } },
  });
  return count === 1 ? next.id : null;
};

/** Chạy một job; lỗi -> đánh dấu failed (nếu video vẫn ở trạng thái `activeStatus`). */
const runJob = async (label: string, videoId: string, activeStatus: string, job: (id: string) => Promise<void>) => {
  const started = Date.now();
  console.log(`[worker] Bắt đầu ${label} ${videoId}`);
  try {
    await job(videoId);
    console.log(`[worker] Xong ${label} ${videoId} sau ${Math.round((Date.now() - started) / 1000)}s`);
  } catch (error) {
    if (error instanceof JobCancelledError) {
      console.log(`[worker] Đã huỷ ${label} ${videoId}`);
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[worker] Lỗi ${label} ${videoId}: ${message}`);
    await prisma.video
      .updateMany({
        where: { id: videoId, status: activeStatus },
        data: { status: "failed", error: message.slice(0, 2000), finishedAt: new Date() },
      })
      .catch(() => undefined);
  }
};

/** Vòng lặp lấy job lần lượt từ một hàng đợi; trả về hàm đánh thức. */
const createLoop = (next: () => Promise<string | null>, handle: (id: string) => Promise<void>) => {
  let timer: NodeJS.Timeout | null = null;
  let busy = false;

  const tick = async () => {
    if (busy) return;
    busy = true;
    timer = null;
    try {
      let jobId: string | null;
      while ((jobId = await next())) await handle(jobId);
    } catch (error) {
      console.error("[worker]", error);
    } finally {
      busy = false;
      timer = setTimeout(tick, POLL_INTERVAL_MS);
    }
  };

  return () => {
    if (busy) return;
    if (timer) clearTimeout(timer);
    void tick();
  };
};

/**
 * Khởi động 2 hàng đợi chạy song song:
 *  - tải video từ link nguồn (yt-dlp, tốn mạng)
 *  - xử lý video (ffmpeg, tốn CPU) — mỗi hàng đợi một job tại một thời điểm
 * Gọi nhiều lần cũng chỉ chạy một bộ vòng lặp trong mỗi tiến trình.
 */
export function startWorker() {
  if (globalForWorker.cinextmaWorker) return globalForWorker.cinextmaWorker;

  const wakeProcess = createLoop(
    () => claim("queued", "processing", "probe", { sourcePath: { not: null } }),
    (id) => runJob("xử lý", id, "processing", processVideo),
  );
  const wakeDownload = createLoop(
    () => claim("download_queued", "downloading", "download", { sourceUrl: { not: null } }),
    async (id) => {
      await runJob("tải về", id, "downloading", downloadRemoteVideo);
      wakeProcess();
    },
  );

  const wake = () => {
    wakeDownload();
    wakeProcess();
  };
  globalForWorker.cinextmaWorker = { wake };
  ensureStorageDirs();

  // Job đang chạy dở khi tiến trình tắt đột ngột -> đưa lại vào hàng đợi
  Promise.all([
    prisma.video.updateMany({ where: { status: "processing" }, data: { status: "queued", stage: null, progress: 0 } }),
    prisma.video.updateMany({ where: { status: "downloading" }, data: { status: "download_queued", stage: null, progress: 0 } }),
  ])
    .then(([processing, downloading]) => {
      const count = processing.count + downloading.count;
      if (count) console.log(`[worker] Khôi phục ${count} job đang dở`);
    })
    .catch(() => undefined)
    .finally(wake);

  console.log("[worker] Đã khởi động");
  return globalForWorker.cinextmaWorker;
}

/** Đánh thức worker ngay khi có job mới (nếu worker chạy trong cùng tiến trình). */
export const wakeWorker = () => globalForWorker.cinextmaWorker?.wake();
