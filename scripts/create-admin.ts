/**
 * Tạo admin mới hoặc đặt lại mật khẩu admin:
 *   npm run admin:create -- <email> <mật khẩu> [tên]
 */
import "dotenv/config";
import { prisma } from "@/server/db";
import { upsertCredentialUser } from "@/server/users";

const [email, password, ...nameParts] = process.argv.slice(2);

if (!email || !password || password.length < 8) {
  console.error("Cách dùng: npm run admin:create -- <email> <mật khẩu (>= 8 ký tự)> [tên]");
  process.exit(1);
}

upsertCredentialUser({ email, password, name: nameParts.join(" ") || "Quản trị viên", role: "admin" })
  .then(({ created }) => console.log(created ? `✔ Đã tạo admin ${email}` : `✔ Đã cập nhật ${email} thành admin và đặt lại mật khẩu`))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
