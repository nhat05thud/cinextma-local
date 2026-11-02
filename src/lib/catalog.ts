/** Danh mục dùng chung cho cả admin và trang xem phim. */

export const GENRES: { name: string; slug: string }[] = [
  { name: "Hành Động", slug: "hanh-dong" },
  { name: "Phiêu Lưu", slug: "phieu-luu" },
  { name: "Hoạt Hình", slug: "hoat-hinh" },
  { name: "Hài Hước", slug: "hai-huoc" },
  { name: "Hình Sự", slug: "hinh-su" },
  { name: "Tài Liệu", slug: "tai-lieu" },
  { name: "Chính Kịch", slug: "chinh-kich" },
  { name: "Gia Đình", slug: "gia-dinh" },
  { name: "Giả Tưởng", slug: "gia-tuong" },
  { name: "Lịch Sử", slug: "lich-su" },
  { name: "Kinh Dị", slug: "kinh-di" },
  { name: "Âm Nhạc", slug: "am-nhac" },
  { name: "Bí Ẩn", slug: "bi-an" },
  { name: "Tình Cảm", slug: "tinh-cam" },
  { name: "Khoa Học Viễn Tưởng", slug: "khoa-hoc-vien-tuong" },
  { name: "Gây Cấn", slug: "gay-can" },
  { name: "Chiến Tranh", slug: "chien-tranh" },
  { name: "Miền Tây", slug: "mien-tay" },
  { name: "Trẻ Em", slug: "tre-em" },
  { name: "Truyền Hình Thực Tế", slug: "truyen-hinh-thuc-te" },
  { name: "Chính Trị", slug: "chinh-tri" },
  { name: "Võ Thuật", slug: "vo-thuat" },
  { name: "Cổ Trang", slug: "co-trang" },
  { name: "Tâm Lý", slug: "tam-ly" },
  { name: "Học Đường", slug: "hoc-duong" },
  { name: "Thể Thao", slug: "the-thao" },
];

/** Thể loại TMDB -> slug thể loại nội bộ (dùng khi import). */
export const TMDB_GENRE_MAP: Record<number, string[]> = {
  28: ["hanh-dong"],
  12: ["phieu-luu"],
  16: ["hoat-hinh"],
  35: ["hai-huoc"],
  80: ["hinh-su"],
  99: ["tai-lieu"],
  18: ["chinh-kich"],
  10751: ["gia-dinh"],
  14: ["gia-tuong"],
  36: ["lich-su"],
  27: ["kinh-di"],
  10402: ["am-nhac"],
  9648: ["bi-an"],
  10749: ["tinh-cam"],
  878: ["khoa-hoc-vien-tuong"],
  53: ["gay-can"],
  10752: ["chien-tranh"],
  37: ["mien-tay"],
  10759: ["hanh-dong", "phieu-luu"],
  10762: ["tre-em"],
  10764: ["truyen-hinh-thuc-te"],
  10765: ["khoa-hoc-vien-tuong", "gia-tuong"],
  10768: ["chien-tranh", "chinh-tri"],
};

export const COUNTRIES: { code: string; name: string }[] = [
  { code: "VN", name: "Việt Nam" },
  { code: "US", name: "Mỹ" },
  { code: "KR", name: "Hàn Quốc" },
  { code: "CN", name: "Trung Quốc" },
  { code: "JP", name: "Nhật Bản" },
  { code: "TH", name: "Thái Lan" },
  { code: "HK", name: "Hồng Kông" },
  { code: "TW", name: "Đài Loan" },
  { code: "GB", name: "Anh" },
  { code: "FR", name: "Pháp" },
  { code: "IN", name: "Ấn Độ" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Úc" },
  { code: "DE", name: "Đức" },
  { code: "ES", name: "Tây Ban Nha" },
  { code: "IT", name: "Ý" },
  { code: "RU", name: "Nga" },
  { code: "PH", name: "Philippines" },
  { code: "ID", name: "Indonesia" },
];

export const countryName = (code?: string | null) =>
  COUNTRIES.find((c) => c.code === code?.toUpperCase())?.name ?? code ?? null;

export const AGE_RATINGS = [
  { value: "P", label: "P — Mọi lứa tuổi" },
  { value: "K", label: "K — Dưới 13 tuổi cần người lớn đi kèm" },
  { value: "T13", label: "T13 — Từ 13 tuổi" },
  { value: "T16", label: "T16 — Từ 16 tuổi" },
  { value: "T18", label: "T18 — Từ 18 tuổi" },
];

export const QUALITIES = ["SD", "HD", "FHD", "2K", "4K"];

export const VIDEO_MODES = [
  {
    value: "auto",
    label: "Tự động (khuyên dùng)",
    description: "File H.264: đóng gói lại sang HLS trong vài giây, giữ nguyên chất lượng. File khác: chuyển mã 1 mức.",
  },
  {
    value: "transcode",
    label: "Đa chất lượng",
    description: "Chuyển mã thành nhiều mức (1080p/720p/480p) để tự đổi theo tốc độ mạng. Chậm hơn nhiều.",
  },
  {
    value: "copy",
    label: "Giữ nguyên",
    description: "Không chuyển mã. Chỉ dùng cho file MP4/MKV H.264.",
  },
];

/** Bỏ dấu tiếng Việt, chỉ giữ chữ thường + số, nối bằng "-". */
export const normalizeSearch = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Slug cho URL (tối đa 80 ký tự). */
export const slugify = (text: string) => normalizeSearch(text).slice(0, 80).replace(/-+$/, "");
