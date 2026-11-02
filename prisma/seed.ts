import "dotenv/config";
import { prisma } from "@/server/db";
import { serverEnv } from "@/server/env";
import { upsertCredentialUser } from "@/server/users";
import { GENRES } from "@/lib/catalog";
import { DEFAULT_SETTINGS } from "@/lib/settings";

async function main() {
  for (const [position, genre] of GENRES.entries()) {
    await prisma.genre.upsert({
      where: { slug: genre.slug },
      update: {},
      create: { ...genre, position },
    });
  }
  console.log(`✔ ${GENRES.length} thể loại`);

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value: String(value) } });
  }
  console.log("✔ Cài đặt mặc định");

  const adminCount = await prisma.user.count({ where: { role: "admin" } });
  if (adminCount === 0) {
    const { email, password, name } = serverEnv.admin;
    await upsertCredentialUser({ email, password, name, role: "admin" });
    console.log(`✔ Tài khoản admin: ${email} / ${password}  (hãy đổi mật khẩu sau khi đăng nhập)`);
  } else {
    console.log(`✔ Đã có ${adminCount} admin, bỏ qua tạo admin`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
