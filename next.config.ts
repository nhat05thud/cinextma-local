import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ảnh đã được resize/nén sẵn bằng sharp khi upload nên không cần tối ưu lại
  images: { unoptimized: true },
  // Các gói native / dùng fs chỉ chạy phía server
  serverExternalPackages: ["better-sqlite3", "sharp", "@tus/server", "@tus/file-store"],
  experimental: {
    optimizePackageImports: ["@heroui/react"],
    // Upload ảnh poster/backdrop, phụ đề qua server action
    serverActions: { bodySizeLimit: "30mb" },
  },
  // Cho phép mở bản dev từ máy khác trong mạng LAN
  allowedDevOrigins: ["*.local", "192.168.*.*", "10.*.*.*"],
};

export default nextConfig;
