import { LinkButton } from "@/components/ui/heroui";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-primary text-7xl font-black">404</p>
      <h2>Không tìm thấy trang</h2>
      <p className="text-foreground-500 max-w-md">Phim hoặc trang bạn tìm không tồn tại hoặc đã bị gỡ.</p>
      <LinkButton href="/" color="primary" variant="shadow">
        Về trang chủ
      </LinkButton>
    </div>
  );
}
