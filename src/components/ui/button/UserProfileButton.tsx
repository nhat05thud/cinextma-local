"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  addToast,
  Avatar,
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { authClient } from "@/lib/auth-client";
import { useCurrentUser } from "@/components/providers/SiteProvider";
import useBreakpoints from "@/hooks/useBreakpoints";
import { User } from "@/utils/icons";

const UserProfileButton: React.FC = () => {
  const user = useCurrentUser();
  const router = useRouter();
  const { mobile } = useBreakpoints();
  const [loggingOut, setLoggingOut] = useState(false);

  if (!user) {
    return (
      <Button as={Link} href="/auth" variant="light" isIconOnly={mobile} title="Đăng nhập" className="min-w-fit">
        {mobile ? <User className="text-xl" /> : "Đăng nhập"}
      </Button>
    );
  }

  const logout = async () => {
    setLoggingOut(true);
    await authClient.signOut();
    addToast({ title: "Đã đăng xuất", color: "primary" });
    router.push("/");
    router.refresh();
  };

  return (
    <Dropdown showArrow placement="bottom-end">
      <DropdownTrigger>
        <Button
          variant="light"
          isIconOnly={mobile}
          className="min-w-fit"
          endContent={
            <Avatar
              showFallback
              name={user.name}
              src={user.image ?? undefined}
              className="size-7"
              fallback={<User className="text-xl" />}
            />
          }
        >
          {!mobile && <span className="max-w-40 truncate">{user.name}</span>}
        </Button>
      </DropdownTrigger>
      <DropdownMenu aria-label="Tài khoản" variant="flat" disabledKeys={loggingOut ? ["logout"] : []}>
        <DropdownSection showDivider title={user.email}>
          <DropdownItem key="library" href="/library" startContent={<Icon icon="mdi:folder-play" />}>
            Thư viện của tôi
          </DropdownItem>
          {user.isAdmin ? (
            <DropdownItem key="admin" href="/admin" startContent={<Icon icon="mdi:shield-crown" />} color="warning">
              Trang quản trị
            </DropdownItem>
          ) : null}
        </DropdownSection>
        <DropdownSection>
          <DropdownItem
            key="logout"
            color="danger"
            className="text-danger"
            startContent={<Icon icon="mdi:logout" />}
            onPress={logout}
          >
            Đăng xuất
          </DropdownItem>
        </DropdownSection>
      </DropdownMenu>
    </Dropdown>
  );
};

export default UserProfileButton;
