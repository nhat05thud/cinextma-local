/**
 * Đóng gói sẵn các icon Iconify đang dùng trong code vào src/lib/iconify-bundle.json
 * để trang web hiển thị icon mà không cần gọi api.iconify.design (chạy được trong mạng nội bộ không có internet).
 *
 *   npm run icons:sync     (chạy lại mỗi khi thêm icon mới)
 */
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("src");
const OUT = path.join(SRC, "lib", "iconify-bundle.json");
const PREFIXES = ["mdi", "solar", "line-md", "simple-icons", "material-symbols", "ic", "tabler"];

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "generated" ? [] : walk(full);
    return /\.(tsx?|jsx?)$/.test(entry.name) ? [full] : [];
  });

async function main() {
  const used = new Map<string, Set<string>>();
  const pattern = new RegExp(`["'\`](${PREFIXES.join("|")}):([a-z0-9]+(?:-[a-z0-9]+)*)["'\`]`, "g");
  for (const file of walk(SRC)) {
    for (const match of fs.readFileSync(file, "utf8").matchAll(pattern)) {
      if (!used.has(match[1])) used.set(match[1], new Set());
      used.get(match[1])!.add(match[2]);
    }
  }

  const collections = [];
  for (const [prefix, names] of used) {
    const url = `https://api.iconify.design/${prefix}.json?icons=${[...names].sort().join(",")}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Không tải được ${url}: ${response.status}`);
    const data = await response.json();
    const missing = data.not_found ?? [];
    delete data.not_found;
    collections.push(data);
    console.log(`${prefix}: ${names.size} icon${missing.length ? ` (không tìm thấy: ${missing.join(", ")})` : ""}`);
  }

  fs.writeFileSync(OUT, JSON.stringify(collections));
  console.log(`✔ Đã ghi ${path.relative(process.cwd(), OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
