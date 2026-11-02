import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "./db";

/**
 * Tạo (hoặc cập nhật mật khẩu + quyền admin cho) một tài khoản đăng nhập bằng email.
 * Dùng cho seed và script `npm run admin:create`, không cần bật đăng ký công khai.
 */
export async function upsertCredentialUser(input: {
  email: string;
  password: string;
  name: string;
  role?: "admin" | "user";
}) {
  const email = input.email.trim().toLowerCase();
  const password = await hashPassword(input.password);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { role: input.role ?? existing.role } });
    const account = await prisma.account.findFirst({ where: { userId: existing.id, providerId: "credential" } });
    if (account) await prisma.account.update({ where: { id: account.id }, data: { password } });
    else
      await prisma.account.create({
        data: { id: randomUUID(), accountId: existing.id, providerId: "credential", userId: existing.id, password },
      });
    return { user: existing, created: false };
  }

  const id = randomUUID();
  const user = await prisma.user.create({
    data: {
      id,
      email,
      name: input.name,
      emailVerified: true,
      role: input.role ?? "user",
      accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password } },
    },
  });
  return { user, created: true };
}
