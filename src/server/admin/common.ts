import "server-only";
import { revalidatePath } from "next/cache";
import { HttpError, requireAdmin } from "../session";
import type { ActionResult } from "@/types/dto";

export { refreshSearchText, uniqueTitleSlug } from "./slug";

/** Bọc server action admin: kiểm tra quyền + chuyển lỗi thành thông báo thân thiện. */
export async function adminAction<T>(fn: () => Promise<ActionResult<T> | T>): Promise<ActionResult<T>> {
  try {
    await requireAdmin();
    const result = await fn();
    if (result && typeof result === "object" && "success" in (result as object)) return result as ActionResult<T>;
    return { success: true, data: result as T };
  } catch (error) {
    if (error instanceof HttpError) return { success: false, message: error.message };
    console.error("[admin]", error);
    return { success: false, message: error instanceof Error ? error.message : "Đã có lỗi xảy ra" };
  }
}

export const revalidateSite = () => revalidatePath("/", "layout");

/** Đọc file từ FormData thành Buffer, kiểm tra kích thước. */
export async function fileFromForm(form: FormData, key = "file", maxMb = 25) {
  const file = form.get(key);
  if (!(file instanceof File) || file.size === 0) throw new Error("Chưa chọn file");
  if (file.size > maxMb * 1024 * 1024) throw new Error(`File quá lớn (tối đa ${maxMb}MB)`);
  return { file, buffer: Buffer.from(await file.arrayBuffer()) };
}
