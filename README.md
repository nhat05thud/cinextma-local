# Cinextma — Rạp phim tại gia

Website xem phim tự host, phát video từ máy chủ của bạn. Có trang quản trị để upload và quản lý phim lẻ, phim bộ như một trang xem phim thực thụ. Chạy được trên **IIS (Windows)** trong mạng nội bộ, và đóng gói **Docker** sẵn để đưa lên internet sau này.

Giao diện dựa trên template [cinextma](https://github.com/wisnuwirayuda15/cinextma) (Next.js + HeroUI). Phần dữ liệu đã được viết lại để dùng kho phim của bạn thay cho TMDB và các trang nhúng bên ngoài.

---

## Tính năng

**Người xem**
- Trang chủ có banner phim nổi bật, mục *Xem tiếp*, các hàng *Mới cập nhật / Phim lẻ / Phim bộ / Xem nhiều / Đánh giá cao*, hàng theo thể loại và hàng tuỳ chỉnh.
- Khám phá theo loại phim, thể loại, quốc gia, năm, sắp xếp.
- Tìm kiếm **không dấu** ("lat mat" tìm ra "Lật Mặt"), tìm được cả theo tên diễn viên.
- Trang chi tiết: trailer, diễn viên, đạo diễn, danh sách phần/tập, phim liên quan.
- Trình phát **Video.js 10**, giao diện tiếng Việt:
  - tự đổi chất lượng (HLS) và chọn chất lượng thủ công;
  - phụ đề nhiều ngôn ngữ;
  - ảnh xem trước khi tua;
  - phím tắt;
  - tự xem tiếp ở vị trí đã dừng;
  - đếm ngược sang tập tiếp theo.
- Tài khoản: thư viện phim đã lưu, lịch sử xem. **Không cần đăng nhập vẫn xem được phim.**

**Quản trị (`/admin`)**
- Thêm phim theo 4 cách:
  - **Lấy từ link** (yt-dlp): dán link video hoặc playlist (YouTube, Vimeo, Facebook, archive.org, link `.mp4`/`.m3u8`… hơn 1.000 website). Hệ thống nhận diện website, lấy tên phim, mô tả, ảnh, danh sách video; bạn chọn video cần lấy, server tự tải về rồi xử lý như video upload. Playlist có thể nhập thành **phim bộ** (mỗi video là một tập) hoặc **nhiều phim lẻ**. Video có DRM không tải được.
  - **Tạo nhanh từ file video:** kéo thả nhiều file, tên phim và năm được đoán từ tên file.
  - **Import từ TMDB:** lấy nội dung tiếng Việt, poster, diễn viên, trailer và danh sách tập.
  - **Nhập thủ công.**
- Upload video **không giới hạn dung lượng**:
  - dùng giao thức tus: chia nhỏ, tự nối lại khi rớt mạng, tiếp tục được sau khi tải lại trang;
  - upload chạy nền khi chuyển trang trong admin.
- **Ảnh bìa có 2 cách:**
  1. **Tự tạo từ video:** hệ thống chọn khung hình đẹp nhất (bỏ khung đen, chấm điểm độ chi tiết), tạo poster dọc 2:3 cắt thông minh vào vùng nổi bật, và ảnh nền 16:9. Admin có thể chọn khung hình khác, hoặc tua tới cảnh ưng ý rồi bấm *Chụp khung hình*.
  2. **Tải ảnh bìa lên:** ngay lúc upload video, hoặc trong tab *Ảnh bìa*.
- Xử lý video tự động bằng ffmpeg:
  - đóng gói HLS;
  - trích phụ đề có sẵn trong MKV;
  - tạo ảnh xem trước khi tua;
  - điền thời lượng phim.
- Phim bộ: nhiều phần, **upload nhiều tập một lúc** (tự nhận *S01E05*, *Tập 5*, *Ep05* từ tên file).
- Phụ đề `.srt/.vtt/.ass`: tự chuyển mã tiếng Việt cũ Windows-1258 sang UTF-8.
- Dashboard: thống kê, lượt xem 14 ngày, phim xem nhiều, dung lượng ổ đĩa.
- Quản lý hàng phim trang chủ, thể loại, người dùng (cấp quyền admin, khoá tài khoản, đặt lại mật khẩu) và cài đặt site.

## Kiến trúc

```
Trình duyệt ──► IIS :80 (cinextma.local) / :8080 (LAN)
                 ├── /media/*  ──► IIS phục vụ thẳng file tĩnh từ storage\public (HLS, ảnh, phụ đề)
                 └── còn lại    ──► URL Rewrite + ARR ──► Next.js 127.0.0.1:3000 (Windows Service "CinextmaWeb")
                                                          ├── SQLite (data\cinextma.db) qua Prisma
                                                          ├── Better Auth (đăng nhập email/mật khẩu)
                                                          ├── tus server (/api/admin/upload)
                                                          └── Worker xử lý video ──► ffmpeg / ffprobe
```

| Thành phần | Công nghệ |
|---|---|
| Web | Next.js 16 (App Router), React 19, HeroUI 2, Tailwind 4 |
| Dữ liệu | Prisma 7 + SQLite (đổi sang PostgreSQL khi lên internet) |
| Đăng nhập | Better Auth (có plugin admin) |
| Upload | tus (`@tus/server` + `tus-js-client`) |
| Video | ffmpeg → HLS (`.m3u8` + `.ts`), sharp cho ảnh |
| Trình phát | Video.js 10 (`@videojs/react` + hls.js) |

**Chế độ xử lý video**

| Chế độ | Khi nào dùng | Tốc độ |
|---|---|---|
| **Tự động** (mặc định) | File H.264 thì chỉ đóng gói lại sang HLS, giữ nguyên chất lượng. File HEVC/khác thì chuyển mã 1 mức (tối đa 1080p). | Vài giây đến vài phút |
| **Đa chất lượng** | Chuyển mã 1080p/720p/480p để tự đổi theo tốc độ mạng (nên dùng khi đưa lên internet). | ~1–3× thời gian thực với CPU |
| **Giữ nguyên** | Ép không chuyển mã (chỉ dùng cho H.264). | Nhanh nhất |

---

## Yêu cầu

- Windows 10/11 hoặc Windows Server, **Node.js 20+** (đang dùng 24), **ffmpeg**, và **yt-dlp + Deno** nếu dùng tính năng lấy video từ link:
  ```powershell
  winget install OpenJS.NodeJS.LTS
  winget install Gyan.FFmpeg
  winget install yt-dlp.yt-dlp      # kèm Deno (cần cho YouTube)
  ```
- Ổ đĩa đủ chỗ cho phim. Đặt `MEDIA_ROOT` ở ổ dung lượng lớn.

## Chạy thử (chế độ phát triển)

```powershell
copy .env.example .env      # rồi chỉnh BETTER_AUTH_SECRET, FFMPEG_PATH...
npm install
npm run setup               # tạo database + thể loại + tài khoản admin
npm run dev                 # http://localhost:3000
```

Đăng nhập admin bằng `ADMIN_EMAIL` / `ADMIN_PASSWORD` trong `.env` (mặc định `admin@cinextma.local` / `Admin@123456`). **Hãy đổi mật khẩu ngay**:

```powershell
npm run admin:create -- admin@cinextma.local "MatKhauMoi123"
```

> Nếu npm cảnh báo "install scripts not yet covered by allowScripts", danh sách cho phép đã nằm trong `package.json`. Nếu vẫn lỗi `better-sqlite3`, chạy `npm rebuild better-sqlite3`.

## Triển khai lên IIS (máy chủ trong nhà / công ty)

Mở **PowerShell bằng quyền Administrator** tại thư mục dự án:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\iis\setup-iis.ps1
```

Script tự làm các bước sau, chạy lại nhiều lần vẫn an toàn:
1. Bật IIS và cài **URL Rewrite 2.1**, **ARR 3.0**, **NSSM** qua winget.
2. Bật reverse proxy của ARR: giữ Host header, không buffer response để HTML stream được.
3. Ghi `BETTER_AUTH_URL`, `TRUSTED_ORIGINS`, đường dẫn ffmpeg tuyệt đối vào `.env`.
4. `npm run db:deploy` và `npm run build`.
5. Tạo Windows Service **CinextmaWeb** (Next.js tại `127.0.0.1:3000`): tự chạy khi khởi động máy, tự khởi động lại khi lỗi, log ở `logs\`.
6. Tạo IIS site **Cinextma** với binding `cinextma.local:80` và cổng LAN `:8080`. `/media` là virtual directory trỏ thẳng vào `storage\public`.
7. Thêm `cinextma.local` vào file hosts và mở firewall cho cổng LAN.

Sau đó truy cập:
- `http://cinextma.local` trên máy chủ;
- `http://<IP-máy-chủ>:8080` từ điện thoại, TV, máy khác trong mạng;
- `http://cinextma.local/admin` cho trang quản trị.

Tham số hay dùng: `-HostName phim.local`, `-Port 80`, `-LanPort 8080` (đặt `0` để tắt), `-AppPort 3000`, `-SkipBuild`.

| Việc | Lệnh |
|---|---|
| Cập nhật sau khi sửa code | `deploy\iis\update.ps1` |
| Gỡ cài đặt (giữ DB & media) | `deploy\iis\uninstall.ps1` |
| Khởi động lại web | `nssm restart CinextmaWeb` |
| Xem log | `logs\web.out.log`, `logs\web.err.log` |

## Hướng dẫn quản trị nhanh

**Phim lẻ**
1. *Thêm phim* → *Tạo nhanh từ file video* → chọn file → *Tạo và tải lên*.
2. Hoặc *Import từ TMDB* → tìm phim → *Import* → tab *Tải video lên*.
3. Ở bước upload, chọn **Ảnh bìa**: *Tự tạo từ video* hoặc *Tải ảnh bìa lên*.
4. Khi video *Sẵn sàng*, ở tab *Video* có thể:
   - xem thử;
   - *Chụp khung hình* tại cảnh đẹp;
   - bấm vào khung hình bất kỳ rồi chọn *Làm poster* hoặc *Làm ảnh nền*;
   - thêm phụ đề.
5. Bật **Xuất bản** (và **Banner trang chủ** nếu muốn phim lên banner).

**Phim bộ**
1. Tạo phim bộ (import TMDB sẽ có sẵn danh sách tập).
2. Tab *Tập phim* → **Tải nhiều tập lên** → chọn tất cả file, kiểm tra số phần/tập được đoán từ tên file → *Tải lên*.
3. Ảnh từng tập tự tạo từ video. Bấm vào một tập để sửa tên, mô tả, ảnh, phụ đề.
4. Khi thêm tập mới: menu `⋮` → *Đưa lên đầu "Mới cập nhật"*.

**Nhập phim có sẵn trên máy chủ** (không cần upload qua trình duyệt):
```powershell
npm run video:import -- "D:\Phim\Avatar.2009.1080p.mkv" --move
```
Video sẽ hiện ở *Video & xử lý → Chưa gắn phim*, bấm *Gắn vào phim*.

**TMDB token:** đăng ký miễn phí tại themoviedb.org → Settings → API → *API Read Access Token*, rồi dán vào *Admin → Cài đặt*.

## Cấu hình `.env`

| Biến | Ý nghĩa |
|---|---|
| `DATABASE_URL` | `file:./data/cinextma.db` (SQLite) |
| `BETTER_AUTH_SECRET` | Chuỗi ngẫu nhiên ≥ 32 ký tự, **không được để lộ** |
| `BETTER_AUTH_URL`, `TRUSTED_ORIGINS` | URL chính của site và các origin khác được phép đăng nhập |
| `ALLOW_SIGNUP` | `false` để chỉ admin tạo tài khoản |
| `MEDIA_ROOT` | Thư mục lưu media: `public\` được phục vụ tại `/media`, `private\` chứa file gốc và upload dở |
| `KEEP_ORIGINALS` | Giữ file gốc để xử lý lại (tốn gấp đôi dung lượng) |
| `FFMPEG_PATH`, `FFPROBE_PATH` | Đường dẫn tuyệt đối khi chạy dạng service |
| `VIDEO_ENCODER` | `libx264` / `h264_nvenc` / `h264_qsv` / `h264_amf` |
| `TRANSCODE_HEIGHTS` | Các mức của chế độ *Đa chất lượng*, ví dụ `1080,720,480` |
| `WORKER_ENABLED` | `false` nếu chạy worker riêng bằng `npm run worker` |
| `YTDLP_PATH`, `DENO_PATH` | Đường dẫn yt-dlp và Deno cho tính năng *Lấy từ link* (script IIS tự điền) |
| `TMDB_ACCESS_TOKEN` | Tuỳ chọn (có thể nhập trong trang Cài đặt) |

> **GPU NVIDIA:** ffmpeg 9 cần driver NVIDIA ≥ 610 cho `h264_nvenc`. Card đời cũ như GTX 970 không có driver này, nên hãy dùng `libx264` hoặc cài ffmpeg 7.x nếu muốn dùng GPU.

## Xử lý sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| Trang tự tải lại liên tục khi chạy `npm run dev` | Dừng dev server, xoá thư mục `.next` rồi chạy lại (cache Turbopack bị hỏng). Bản chạy trên IIS không bị. |
| *Lấy từ link* báo lỗi với website vốn vẫn chạy | Website vừa đổi cấu trúc: vào **Admin → Cài đặt → yt-dlp → Cập nhật**. |
| Video báo lỗi "Không tìm thấy ffmpeg" | Đặt `FFMPEG_PATH`/`FFPROBE_PATH` là đường dẫn tuyệt đối trong `.env` rồi `nssm restart CinextmaWeb`. |
| Không đăng nhập được khi truy cập bằng IP LAN | Thêm `http://<IP>:8080` vào `TRUSTED_ORIGINS` trong `.env` (thường không cần vì cùng origin). |
| Thêm icon mới (`icon="mdi:..."`) không hiện khi không có internet | Chạy `npm run icons:sync` để đóng gói icon vào `src/lib/iconify-bundle.json`, rồi build lại. |
| Chữ tiếng Việt trong `.env` bị lỗi sau khi sửa bằng PowerShell | Mở và lưu `.env` bằng VS Code (UTF-8). PowerShell 5.1 cần `-Encoding UTF8`. |

## Sao lưu

Dừng service (`nssm stop CinextmaWeb`) rồi sao chép:
- `data\cinextma.db`: phim, tập, người dùng, lịch sử.
- `storage\public`: video HLS, ảnh, phụ đề.
- `storage\private\originals`: file gốc (tuỳ chọn).
- `.env`

## Đưa lên internet

Code đã sẵn sàng. Những việc cần làm khi publish:

1. **Server Linux + Docker:** `docker compose up -d --build`. Image có sẵn ffmpeg; dữ liệu nằm ở `./data` và `./storage`.
2. **HTTPS:** đặt Caddy, Nginx hoặc Cloudflare Tunnel trước cổng 3000; cập nhật `BETTER_AUTH_URL=https://ten-mien.com`.
3. **PostgreSQL** (khuyên dùng khi nhiều người dùng):
   - đổi `provider = "postgresql"` trong `prisma/schema.prisma`;
   - `npm i @prisma/adapter-pg pg`, rồi đổi adapter trong `src/server/db.ts` sang `PrismaPg`;
   - đổi `DATABASE_URL`, xoá `prisma/migrations` và chạy `npm run db:migrate` để tạo migration mới.
4. **Video:** dùng chế độ *Đa chất lượng* để người xem mạng yếu vẫn xem mượt. Khi lượng xem lớn, có thể đưa thư mục `storage/public` lên CDN hoặc object storage (Cloudflare R2, S3); URL media chỉ đi qua hàm `mediaUrl()` trong `src/lib/media.ts`.
5. **Bản quyền:** chỉ phát những nội dung bạn có quyền phân phối.

## Cấu trúc thư mục

```
prisma/                 schema, migrations, seed
scripts/                worker, create-admin, import-video
deploy/iis/             setup-iis.ps1, update.ps1, uninstall.ps1, web.config mẫu
src/app/(site)/         trang người xem (trang chủ, khám phá, chi tiết, player...)
src/app/admin/          trang quản trị
src/app/api/            auth, upload (tus), lưu tiến độ xem
src/app/media/          phục vụ file media khi chạy dev (IIS phục vụ trực tiếp khi production)
src/server/             db, auth, queries, media pipeline (ffmpeg, ảnh bìa, phụ đề, worker)
src/components/admin/   giao diện quản trị
src/components/sections giao diện người xem
```

## Giấy phép

MIT. Template gốc © Wisnu Wirayuda.
