"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/helpers";
import { Next } from "@/utils/icons";
import { useSite } from "@/components/providers/SiteProvider";

export interface BrandLogoProps {
  animate?: boolean;
  className?: string;
  href?: string;
}

const BrandLogo: React.FC<BrandLogoProps> = ({ animate = false, className, href = "/" }) => {
  const pathName = usePathname();
  const { settings } = useSite();
  const tv = pathName.startsWith("/tv/") || pathName.startsWith("/series");
  // Chèn biểu tượng ▶ vào giữa tên site, giống logo gốc "CINE ▶ TMA"
  const name = settings.siteName.toUpperCase();
  const middle = Math.ceil(name.length / 2);
  const [left, right] = name === "CINEXTMA" ? ["CINE", "TMA"] : [name.slice(0, middle), name.slice(middle)];

  return (
    <Link href={href} className="group">
      <span
        className={cn(
          "font-(family-name:--font-saira) flex items-center bg-linear-to-r from-transparent from-80% via-white to-transparent bg-size-[200%_100%] bg-clip-text bg-position-[40%] text-2xl font-semibold text-foreground/60 md:text-3xl",
          "tracking-widest transition-[letter-spacing] group-hover:tracking-[0.2em]",
          { "animate-shine": animate, "text-foreground": !animate },
          className,
        )}
      >
        {left}
        <span>
          <Next className={cn("size-full px-[2px] transition-colors", tv ? "text-warning" : "text-primary")} />
        </span>
        {right}
      </span>
    </Link>
  );
};

export default BrandLogo;
