"use client";

import NavbarMenuItems from "../other/NavbarMenuItems";
import { siteConfig } from "@/config/site";
import { usePathname } from "next/navigation";

const Sidebar: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathName = usePathname();
  const shouldShowSidebar = siteConfig.navItems.some((item) => item.href === pathName);

  return (
    <div className="flex h-full">
      {shouldShowSidebar && (
        <div className="hidden md:block">
          <div className="top-0 left-0 w-20" />
          <aside className="fixed top-0 left-0 z-30 h-screen w-fit">
            <nav className="bg-background text-foreground flex h-full flex-col justify-center pl-2">
              <NavbarMenuItems size="sm" isVertical withIcon variant="light" />
            </nav>
          </aside>
        </div>
      )}
      {children}
    </div>
  );
};

export default Sidebar;
