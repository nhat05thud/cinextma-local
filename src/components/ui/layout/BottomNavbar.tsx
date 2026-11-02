"use client";

import { siteConfig } from "@/config/site";
import { cn } from "@/utils/helpers";
import { Chip } from "@heroui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const BottomNavbar = () => {
  const pathName = usePathname();
  const show = siteConfig.navItems.some((item) => item.href === pathName);
  if (!show) return null;

  return (
    <>
      <div className="pt-20 md:hidden" />
      <div className="border-secondary-background bg-background fixed bottom-0 left-0 z-50 block h-fit w-full translate-y-px border-t py-2 md:hidden">
        <div className="mx-auto grid h-full max-w-lg grid-cols-5">
          {siteConfig.navItems.map((item) => {
            const isActive = pathName === item.href;
            return (
              <Link href={item.href} key={item.href} className="text-foreground flex items-center justify-center">
                <div className="flex max-h-[50px] flex-col items-center justify-center">
                  <Chip
                    size="lg"
                    variant={isActive ? "solid" : "light"}
                    classNames={{ base: "py-[2px] transition-all", content: "size-full" }}
                  >
                    {isActive ? item.activeIcon : item.icon}
                  </Chip>
                  <p className={cn("text-[10px]", { "font-bold": isActive })}>{item.label}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default BottomNavbar;
