"use client";

import IconButton from "./IconButton";
import VaulDrawer from "@/components/ui/overlay/VaulDrawer";
import {
  EmailIcon,
  EmailShareButton,
  FacebookIcon,
  FacebookShareButton,
  TelegramIcon,
  TelegramShareButton,
  TwitterShareButton,
  WhatsappIcon,
  WhatsappShareButton,
  XIcon,
} from "react-share";
import { Divider } from "@heroui/react";
import CopyButton from "./CopyButton";
import type { ContentType } from "@/types/dto";
import { Share } from "@/utils/icons";
import { useDisclosure } from "@mantine/hooks";
import { useSite } from "@/components/providers/SiteProvider";

interface ShareButtonProps {
  title: string;
  slug: string;
  type?: ContentType;
}

const SHARE_BUTTONS = [
  { label: "Facebook", Icon: FacebookIcon, Component: FacebookShareButton },
  { label: "Telegram", Icon: TelegramIcon, Component: TelegramShareButton },
  { label: "WhatsApp", Icon: WhatsappIcon, Component: WhatsappShareButton },
  { label: "X (Twitter)", Icon: XIcon, Component: TwitterShareButton },
  { label: "Email", Icon: EmailIcon, Component: EmailShareButton },
];

const ShareButton: React.FC<ShareButtonProps> = ({ title, slug, type = "movie" }) => {
  const { settings } = useSite();
  const [opened, { open, close }] = useDisclosure(false);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/${type}/${slug}`;
  const description = `Xem ${title} trên ${settings.siteName}`;

  return (
    <>
      <IconButton icon={<Share size={20} />} variant="ghost" tooltip="Chia sẻ" onPress={open} />
      <VaulDrawer open={opened} onClose={close} backdrop="blur" title="Chia sẻ qua">
        <div className="space-y-8 px-6">
          <div className="grid grid-cols-5 gap-x-5 gap-y-3 md:gap-x-10 md:gap-y-5">
            {SHARE_BUTTONS.map(({ Component, Icon, label }) => (
              <Component
                key={label}
                title={description}
                url={url}
                subject={description}
                onClick={close}
                className="flex flex-col items-center justify-center gap-2"
              >
                <Icon className="rounded-md" size={45} />
                <span className="text-xs">{label}</span>
              </Component>
            ))}
          </div>
        </div>
        <Divider className="my-4" />
        <div className="space-y-4 px-6">
          <CopyButton text={url} label="Sao chép liên kết" copiedLabel="Đã sao chép liên kết!" onCopied={close} />
        </div>
      </VaulDrawer>
    </>
  );
};

export default ShareButton;
