import Faq from "@/components/sections/About/Faq";
import SectionTitle from "@/components/ui/other/SectionTitle";
import { getSettings } from "@/server/queries/settings";

export const metadata = { title: "Giới thiệu" };

const FAQ = [
  {
    q: "Làm sao để xem tiếp phim đang xem dở?",
    a: "Đăng nhập tài khoản. Hệ thống tự lưu vị trí bạn đang xem và hiện trong mục “Xem tiếp” ở trang chủ.",
  },
  {
    q: "Phim bị giật hoặc tải chậm?",
    a: "Mở biểu tượng bánh răng trong trình phát và chọn chất lượng thấp hơn, hoặc để chế độ Tự động.",
  },
  {
    q: "Bật phụ đề như thế nào?",
    a: "Bấm nút CC trên trình phát (hoặc phím C) và chọn ngôn ngữ phụ đề trong menu cài đặt.",
  },
  {
    q: "Phím tắt khi xem phim?",
    a: "Space/K: phát/tạm dừng • ←/→: tua 10 giây • ↑/↓: âm lượng • F: toàn màn hình • M: tắt tiếng • C: phụ đề.",
  },
];

export default async function AboutPage() {
  const settings = await getSettings();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-3">
        <SectionTitle size="h3">Về {settings.siteName}</SectionTitle>
        <p className="text-foreground-600">{settings.siteDescription}</p>
      </div>
      <div className="flex flex-col gap-3">
        <SectionTitle size="h5">Câu hỏi thường gặp</SectionTitle>
        <Faq items={FAQ} />
      </div>
    </div>
  );
}
