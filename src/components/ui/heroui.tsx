"use client";

// HeroUI v2 không import trực tiếp được trong Server Component (createContext lúc khởi tạo module).
// Server Component import các component này qua file "use client" ở đây.
import NextLink from "next/link";
import { Button, Chip, type ButtonProps, type ChipProps } from "@heroui/react";
import { Icon as IconifyIcon, type IconProps } from "@iconify/react";

export {
  Alert,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Chip,
  Divider,
  Link,
  Progress,
} from "@heroui/react";

/** Button dạng link điều hướng nội bộ — dùng được trong Server Component. */
export const LinkButton: React.FC<Omit<ButtonProps, "as"> & { href: string }> = (props) => (
  <Button as={NextLink} {...props} />
);

export const LinkChip: React.FC<Omit<ChipProps, "as"> & { href: string }> = (props) => (
  <Chip as={NextLink} {...props} />
);

export const Icon: React.FC<IconProps> = (props) => <IconifyIcon {...props} />;
