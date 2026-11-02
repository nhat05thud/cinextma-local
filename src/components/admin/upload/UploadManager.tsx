"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "tus-js-client";
import { addToast } from "@heroui/react";

export type UploadTarget = { targetType: "title" | "episode"; targetId: string } | null;

export type UploadRequest = {
  file: File;
  /** Mô tả hiển thị, ví dụ "Avatar" hoặc "Squid Game • P1 T3" */
  label: string;
  target: UploadTarget;
  mode: string;
  autoCover: boolean;
};

export type UploadItem = UploadRequest & {
  id: string;
  status: "queued" | "uploading" | "paused" | "done" | "error";
  progress: number;
  bytesUploaded: number;
  speed: number;
  videoId?: string;
  error?: string;
};

type UploadContextValue = {
  items: UploadItem[];
  enqueue: (requests: UploadRequest[]) => void;
  pause: (id: string) => void;
  resume: (id: string) => void;
  cancel: (id: string) => void;
  clearFinished: () => void;
};

const UploadContext = createContext<UploadContextValue | null>(null);

export const useUploads = () => {
  const context = useContext(UploadContext);
  if (!context) throw new Error("useUploads phải nằm trong UploadProvider");
  return context;
};

const CHUNK_SIZE = 50 * 1024 * 1024;

/**
 * Hàng đợi upload video (giao thức tus): tải lần lượt từng file, tự thử lại khi rớt mạng,
 * có thể tiếp tục sau khi tải lại trang. Nằm ở layout admin nên vẫn chạy khi chuyển trang trong admin.
 */
export const UploadProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const router = useRouter();
  const [items, setItems] = useState<UploadItem[]>([]);
  const uploads = useRef(new Map<string, Upload>());

  const update = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const start = useCallback(
    (item: UploadItem) => {
      let lastBytes = 0;
      let lastTime = Date.now();
      const upload = new Upload(item.file, {
        endpoint: "/api/admin/upload",
        chunkSize: CHUNK_SIZE,
        retryDelays: [0, 2000, 5000, 10000, 20000, 30000],
        removeFingerprintOnSuccess: true,
        metadata: {
          filename: item.file.name,
          filetype: item.file.type || "application/octet-stream",
          targetType: item.target?.targetType ?? "",
          targetId: item.target?.targetId ?? "",
          mode: item.mode,
          autoCover: String(item.autoCover),
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const now = Date.now();
          const elapsed = (now - lastTime) / 1000;
          if (elapsed < 0.5 && bytesUploaded < bytesTotal) return;
          const speed = elapsed > 0 ? (bytesUploaded - lastBytes) / elapsed : 0;
          lastBytes = bytesUploaded;
          lastTime = now;
          update(item.id, { progress: (bytesUploaded / bytesTotal) * 100, bytesUploaded, speed });
        },
        onSuccess: (payload) => {
          const videoId = payload?.lastResponse?.getHeader("X-Video-Id") ?? undefined;
          uploads.current.delete(item.id);
          update(item.id, { status: "done", progress: 100, videoId });
          addToast({ title: `Đã tải lên: ${item.label}`, description: "Video đang được xử lý.", color: "success" });
          router.refresh();
        },
        onError: (error) => {
          uploads.current.delete(item.id);
          const message = error.message.match(/response text: (.*?)(?:,|$)/)?.[1] || error.message;
          update(item.id, { status: "error", error: message });
          addToast({ title: `Lỗi tải lên: ${item.label}`, description: message, color: "danger" });
        },
      });
      uploads.current.set(item.id, upload);
      update(item.id, { status: "uploading", error: undefined });
      // Tiếp tục từ lần upload dở trước đó (cùng file) nếu có
      upload
        .findPreviousUploads()
        .then((previous) => {
          if (previous.length) upload.resumeFromPreviousUpload(previous[0]);
          upload.start();
        })
        .catch(() => upload.start());
    },
    [router, update],
  );

  // Mỗi lần chỉ tải một file để tận dụng hết băng thông và ổ đĩa
  useEffect(() => {
    if (items.some((i) => i.status === "uploading")) return;
    const next = items.find((i) => i.status === "queued");
    if (next) start(next);
  }, [items, start]);

  // Cảnh báo khi đóng tab lúc đang upload
  const active = items.some((i) => i.status === "uploading" || i.status === "queued");
  useEffect(() => {
    if (!active) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);

  const value = useMemo<UploadContextValue>(
    () => ({
      items,
      enqueue: (requests) =>
        setItems((current) => [
          ...current,
          ...requests.map((r) => ({
            ...r,
            id: crypto.randomUUID(),
            status: "queued" as const,
            progress: 0,
            bytesUploaded: 0,
            speed: 0,
          })),
        ]),
      pause: (id) => {
        void uploads.current.get(id)?.abort();
        uploads.current.delete(id);
        update(id, { status: "paused", speed: 0 });
      },
      resume: (id) => update(id, { status: "queued" }),
      cancel: (id) => {
        const upload = uploads.current.get(id);
        if (upload) void upload.abort(true);
        uploads.current.delete(id);
        setItems((current) => current.filter((i) => i.id !== id));
      },
      clearFinished: () => setItems((current) => current.filter((i) => i.status !== "done")),
    }),
    [items, update],
  );

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
};
