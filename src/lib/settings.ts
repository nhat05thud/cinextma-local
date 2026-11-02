export type SiteSettings = {
  siteName: string;
  siteDescription: string;
  footerText: string;
  /** Số phim mỗi hàng trên trang chủ */
  homeRowLimit: number;
};

export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: "Cinextma",
  siteDescription: "Xem phim chất lượng cao, phim lẻ, phim bộ mới nhất.",
  footerText: "Cinextma — Rạp phim tại gia.",
  homeRowLimit: 20,
};
