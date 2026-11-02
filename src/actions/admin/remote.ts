"use server";

import { adminAction, revalidateSite } from "@/server/admin/common";
import { importFromRemote, type RemoteImportInput } from "@/server/admin/remote-import";
import { analyzeRemote, updateYtdlp, type RemoteInfo } from "@/server/media/remote";

/** Đọc thông tin video / playlist từ link (chưa tải gì). */
export async function analyzeRemoteUrl(url: string, referer?: string | null) {
  return adminAction<RemoteInfo>(() => analyzeRemote(url, referer));
}

/** Tạo phim + xếp video vào hàng đợi tải về; worker tự tải và xử lý. */
export async function importRemote(input: RemoteImportInput) {
  return adminAction(async () => {
    const result = await importFromRemote(input);
    revalidateSite();
    return {
      success: true,
      message: `Đã thêm ${result.count} video vào hàng đợi tải về`,
      data: result,
    };
  });
}

export async function updateYtdlpAction() {
  return adminAction(async () => ({ success: true, message: await updateYtdlp() }));
}
