"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, Button, Drawer, DrawerBody, DrawerContent } from "@heroui/react";
import { Icon } from "@iconify/react";
import BrandLogo from "@/components/ui/other/BrandLogo";
import ThemeSwitchDropdown from "@/components/ui/input/ThemeSwitchDropdown";
import { useCurrentUser } from "@/components/providers/SiteProvider";
import { cn } from "@/utils/helpers";
import { UploadProvider } from "./upload/UploadManager";
import UploadPanel from "./upload/UploadPanel";

const NAV = [
  { href: "/admin", label: "Tổng quan", icon: "mdi:view-dashboard-outline", exact: true },
  { href: "/admin/titles", label: "Quản lý phim", icon: "mdi:movie-open-outline" },
  { href: "/admin/titles/new", label: "Thêm phim", icon: "mdi:plus-box-outline", exact: true },
  { href: "/admin/videos", label: "Video & xử lý", icon: "mdi:video-box" },
  { href: "/admin/collections", label: "Trang chủ", icon: "mdi:view-carousel-outline" },
  { href: "/admin/genres", label: "Thể loại", icon: "mdi:tag-multiple-outline" },
  { href: "/admin/users", label: "Người dùng", icon: "mdi:account-group-outline" },
  { href: "/admin/settings", label: "Cài đặt", icon: "mdi:cog-outline" },
];

const NavLinks: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const pathname = usePathname();
  const isActive = (item: (typeof NAV)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href) && !(item.href === "/admin/titles" && pathname === "/admin/titles/new");

  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            isActive(item) ? "bg-primary text-primary-foreground shadow-md" : "text-foreground-600 hover:bg-default-100",
          )}
        >
          <Icon icon={item.icon} fontSize={20} />
          {item.label}
        </Link>
      ))}
      <Link
        href="/"
        target="_blank"
        className="text-foreground-600 hover:bg-default-100 mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium"
      >
        <Icon icon="mdi:open-in-new" fontSize={20} />
        Xem trang web
      </Link>
    </nav>
  );
};

const AdminShell: React.FC<React.PropsWithChildren> = ({ children }) => {
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);

  return (
    <UploadProvider>
      <div className="bg-default-50 dark:bg-background min-h-dvh">
        <aside className="border-divider bg-background fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r p-4 lg:flex">
          <div className="mb-6 flex items-center gap-2 px-2">
            <BrandLogo href="/admin" className="text-xl md:text-2xl" />
            <span className="bg-warning/20 text-warning rounded-md px-1.5 py-0.5 text-[10px] font-bold">ADMIN</span>
          </div>
          <NavLinks />
        </aside>

        <div className="lg:pl-64">
          <header className="border-divider bg-background/80 sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b px-4 backdrop-blur-md md:px-6">
            <div className="flex items-center gap-2">
              <Button isIconOnly variant="light" className="lg:hidden" onPress={() => setOpen(true)} aria-label="Menu">
                <Icon icon="mdi:menu" fontSize={24} />
              </Button>
              <span className="text-foreground-500 hidden text-sm sm:inline">Trang quản trị</span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeSwitchDropdown />
              {user && (
                <div className="flex items-center gap-2">
                  <span className="hidden text-sm md:inline">{user.name}</span>
                  <Avatar size="sm" name={user.name} src={user.image ?? undefined} />
                </div>
              )}
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl p-4 pb-32 md:p-6 md:pb-32">{children}</main>
        </div>

        <Drawer isOpen={open} onOpenChange={setOpen} placement="left" size="xs">
          <DrawerContent>
            <DrawerBody className="py-6">
              <div className="mb-4 px-2">
                <BrandLogo href="/admin" className="text-xl" />
              </div>
              <NavLinks onNavigate={() => setOpen(false)} />
            </DrawerBody>
          </DrawerContent>
        </Drawer>

        <UploadPanel />
      </div>
    </UploadProvider>
  );
};

export default AdminShell;
