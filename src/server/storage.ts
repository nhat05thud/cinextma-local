import fs from "node:fs";
import path from "node:path";
import { serverEnv } from "./env";

/** Thư mục được phục vụ public tại /media/* (HLS, ảnh, phụ đề). */
export const PUBLIC_DIR = path.join(serverEnv.mediaRoot, "public");
/** Thư mục không bao giờ public (file gốc, file đang upload). */
export const PRIVATE_DIR = path.join(serverEnv.mediaRoot, "private");
export const UPLOAD_TMP_DIR = path.join(PRIVATE_DIR, "uploads");
export const ORIGINALS_DIR = path.join(PRIVATE_DIR, "originals");

export const ensureStorageDirs = () => {
  for (const dir of [PUBLIC_DIR, PRIVATE_DIR, UPLOAD_TMP_DIR, ORIGINALS_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

/**
 * Nối đường dẫn tương đối vào thư mục gốc và chặn path traversal (../).
 * Trả về null nếu đường dẫn thoát ra ngoài thư mục gốc.
 */
export const safeJoin = (root: string, relative: string): string | null => {
  const resolved = path.resolve(root, relative.replace(/^[/\\]+/, ""));
  const rootWithSep = path.resolve(root) + path.sep;
  return resolved.startsWith(rootWithSep) ? resolved : null;
};

/** Đổi đường dẫn tuyệt đối trong PUBLIC_DIR thành đường dẫn tương đối dạng posix để lưu DB. */
export const toPublicRelative = (absolute: string) =>
  path.relative(PUBLIC_DIR, absolute).split(path.sep).join("/");

export const publicPath = (relative: string) => path.join(PUBLIC_DIR, ...relative.split("/"));
export const privatePath = (relative: string) => path.join(PRIVATE_DIR, ...relative.split("/"));

export const removeQuietly = async (target: string | null | undefined) => {
  if (!target) return;
  await fs.promises.rm(target, { recursive: true, force: true }).catch(() => undefined);
};

/** Tổng dung lượng (bytes) của một thư mục, đệ quy. */
export const directorySize = async (dir: string): Promise<number> => {
  let total = 0;
  const entries = await fs.promises.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += await directorySize(full);
    else total += (await fs.promises.stat(full).catch(() => ({ size: 0 }))).size;
  }
  return total;
};
