"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addToast } from "@heroui/react";
import { getVideoStatuses } from "@/actions/admin/videos";
import type { ActionResult } from "@/types/dto";
import { isActiveVideo } from "@/types/media";

/** Chạy server action admin: hiện thông báo, làm mới dữ liệu trang khi thành công. */
export function useAdminAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = useCallback(
    <T>(
      fn: () => Promise<ActionResult<T>>,
      options: { refresh?: boolean; silent?: boolean; onSuccess?: (data: T | undefined) => void } = {},
    ) =>
      new Promise<ActionResult<T>>((resolve) =>
        startTransition(async () => {
          const result = await fn();
          if (result.message && (!options.silent || !result.success)) {
            addToast({ title: result.message, color: result.success ? "success" : "danger" });
          }
          if (result.success) {
            options.onSuccess?.(result.data);
            if (options.refresh !== false) router.refresh();
          }
          resolve(result);
        }),
      ),
    [router],
  );

  return { run, pending };
}

export type VideoState = { id: string; status: string; progress: number; stage: string | null; error: string | null };

/**
 * Theo dõi trạng thái xử lý video: poll các video đang chờ/đang xử lý,
 * khi có video xong (hoặc lỗi) thì làm mới trang để hiện khung hình, phụ đề...
 */
export function useVideoStatuses(initial: VideoState[]) {
  const router = useRouter();
  const [states, setStates] = useState<Record<string, VideoState>>(() =>
    Object.fromEntries(initial.map((v) => [v.id, v])),
  );
  // Dữ liệu từ server đổi (sau router.refresh) -> đồng bộ lại ngay trong lúc render
  const initialKey = initial.map((v) => `${v.id}:${v.status}:${v.progress}`).join();
  const [syncedKey, setSyncedKey] = useState(initialKey);
  if (syncedKey !== initialKey) {
    setSyncedKey(initialKey);
    setStates(Object.fromEntries(initial.map((v) => [v.id, v])));
  }

  const activeIds = Object.values(states)
    .filter((v) => isActiveVideo(v.status))
    .map((v) => v.id)
    .join();

  useEffect(() => {
    if (!activeIds) return;
    const timer = setInterval(async () => {
      const result = await getVideoStatuses(activeIds.split(","));
      if (!result.success || !result.data) return;
      let finished = false;
      setStates((current) => {
        const next = { ...current };
        for (const v of result.data!) {
          if (current[v.id]?.status !== v.status && (v.status === "ready" || v.status === "failed")) finished = true;
          next[v.id] = v;
        }
        return next;
      });
      if (finished) router.refresh();
    }, 2500);
    return () => clearInterval(timer);
  }, [activeIds, router]);

  return states;
}
