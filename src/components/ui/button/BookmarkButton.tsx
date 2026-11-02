"use client";

import { useState, useTransition } from "react";
import { addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { toggleWatchlist } from "@/actions/library";
import { useCurrentUser } from "@/components/providers/SiteProvider";
import IconButton from "./IconButton";

interface BookmarkButtonProps {
  titleId: string;
  initialSaved?: boolean;
  isTooltipDisabled?: boolean;
}

const BookmarkButton: React.FC<BookmarkButtonProps> = ({ titleId, initialSaved = false, isTooltipDisabled }) => {
  const user = useCurrentUser();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();

  const handlePress = () => {
    if (!user) {
      addToast({ title: "Vui lòng đăng nhập để lưu phim vào thư viện", color: "warning" });
      return;
    }
    startTransition(async () => {
      const result = await toggleWatchlist(titleId);
      if (result.success) setSaved(!!result.data?.saved);
      addToast({ title: result.message, color: result.success ? "success" : "danger" });
    });
  };

  return (
    <IconButton
      icon={<Icon icon={saved ? "mdi:bookmark-check" : "mdi:bookmark-plus-outline"} fontSize={22} />}
      variant={saved ? "shadow" : "ghost"}
      color={saved ? "warning" : "default"}
      isLoading={pending}
      onPress={handlePress}
      tooltip={isTooltipDisabled ? undefined : saved ? "Bỏ khỏi thư viện" : "Thêm vào thư viện"}
    />
  );
};

export default BookmarkButton;
