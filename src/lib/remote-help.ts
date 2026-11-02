/** Hướng dẫn dùng chung (client + server) cho tính năng "Lấy từ link". */

export const isBlobUrl = (value: string) => /^\s*blob:/i.test(value);

/** Link trỏ thẳng tới file/luồng video (thường copy từ F12 → Network). */
export const isMediaUrl = (value: string) => /\.(m3u8|mpd|mp4|m4v|webm|mkv)(\?|#|$)/i.test(value.trim());

export const BLOB_HELP =
  "Link blob: chỉ tồn tại bên trong tab trình duyệt đang phát video (do trình phát tạo ra), máy chủ không tải được. " +
  "Hãy dán link của trang xem phim. Nếu vẫn không được: mở trang đó, nhấn F12 → tab Network → gõ “m3u8” vào ô lọc → bấm phát video → " +
  "chuột phải vào dòng .m3u8 → Copy → Copy URL, dán link đó vào đây và điền link trang vào ô “Trang chứa video”.";

export const NOT_FOUND_HELP =
  "Không tìm thấy video trên trang này — trang có thể dùng trình phát tự tạo link (blob:). " +
  "Mở trang, nhấn F12 → Network, gõ “m3u8” vào ô lọc, bấm phát video rồi copy link .m3u8 dán vào đây, kèm link trang ở ô “Trang chứa video”.";
