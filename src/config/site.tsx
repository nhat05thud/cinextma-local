import { BiSearchAlt2, BiSolidSearchAlt2 } from "react-icons/bi";
import { GoHomeFill, GoHome } from "react-icons/go";
import { HiComputerDesktop } from "react-icons/hi2";
import { IoIosSunny } from "react-icons/io";
import { IoCompass, IoCompassOutline, IoMoon } from "react-icons/io5";
import { PiTelevisionSimple, PiTelevisionSimpleFill } from "react-icons/pi";
import { TbFolder, TbFolderFilled } from "react-icons/tb";

export type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
};

export const siteConfig = {
  favicon: "/favicon.ico",
  navItems: [
    {
      label: "Trang chủ",
      href: "/",
      icon: <GoHome className="size-full" />,
      activeIcon: <GoHomeFill className="size-full" />,
    },
    {
      label: "Khám phá",
      href: "/discover",
      icon: <IoCompassOutline className="size-full" />,
      activeIcon: <IoCompass className="size-full" />,
    },
    {
      label: "Phim bộ",
      href: "/series",
      icon: <PiTelevisionSimple className="size-full" />,
      activeIcon: <PiTelevisionSimpleFill className="size-full" />,
    },
    {
      label: "Tìm kiếm",
      href: "/search",
      icon: <BiSearchAlt2 className="size-full" />,
      activeIcon: <BiSolidSearchAlt2 className="size-full" />,
    },
    {
      label: "Thư viện",
      href: "/library",
      icon: <TbFolder className="size-full" />,
      activeIcon: <TbFolderFilled className="size-full" />,
    },
  ] satisfies NavItem[],
  themes: [
    { name: "light", label: "Sáng", icon: <IoIosSunny className="size-full" /> },
    { name: "dark", label: "Tối", icon: <IoMoon className="size-full" /> },
    { name: "system", label: "Theo hệ thống", icon: <HiComputerDesktop className="size-full" /> },
  ] as const,
};
