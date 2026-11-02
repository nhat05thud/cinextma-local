"use client";

import { siteConfig } from "@/config/site";
import { useSite } from "@/components/providers/SiteProvider";
import { cn } from "@/utils/helpers";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandLogo from "../other/BrandLogo";

const Footer: React.FC<{ className?: string }> = ({ className }) => {
  const pathName = usePathname();
  const { settings } = useSite();
  if (pathName.includes("/player") || pathName.startsWith("/auth")) return null;

  return (
    <footer
      className={cn(
        "border-secondary-background mt-16 flex w-full flex-col items-center justify-center gap-3 border-t px-4 py-8 text-center",
        className,
      )}
    >
      <BrandLogo className="text-xl md:text-2xl" />
      <p className="text-foreground-500 max-w-xl text-sm">{settings.siteDescription}</p>
      <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
        {siteConfig.navItems.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className={cn("hover:text-primary transition-colors", pathName === href && "text-primary font-semibold")}
          >
            {label}
          </Link>
        ))}
        <Link href="/about" className="hover:text-primary transition-colors">
          Giới thiệu
        </Link>
      </nav>
      <p className="text-foreground-400 text-xs">
        © {new Date().getFullYear()} {settings.footerText}
      </p>
    </footer>
  );
};

export default Footer;
