import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { prisma } from "./db";
import { serverEnv } from "./env";

/** Origin mà trình duyệt đang truy cập (qua IIS/ARR cần bật preserveHostHeader). */
const requestOrigin = (request?: Request) => {
  if (!request) return null;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return null;
  const proto =
    request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return `${proto}://${host}`;
};

export const auth = betterAuth({
  appName: "Cinextma",
  baseURL: serverEnv.authUrl,
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    disableSignUp: !serverEnv.allowSignup,
  },
  // Cho phép truy cập cùng origin qua nhiều host (localhost, tên miền IIS, IP LAN).
  trustedOrigins: async (request) => [
    serverEnv.authUrl,
    ...serverEnv.trustedOrigins,
    requestOrigin(request),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  advanced: {
    // IIS ghi đè X-Real-IP bằng REMOTE_ADDR (xem deploy/iis/site.web.config); Node chỉ nghe 127.0.0.1
    // nên client không tự gửi được header này. X-Forwarded-For cho trường hợp chạy sau nginx/Caddy.
    ipAddress: { ipAddressHeaders: ["x-real-ip", "x-forwarded-for"] },
  },
  plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] }), nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
