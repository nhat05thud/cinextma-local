"use client";

import Rating from "@/components/ui/other/Rating";
import VaulDrawer from "@/components/ui/overlay/VaulDrawer";
import useBreakpoints from "@/hooks/useBreakpoints";
import useDeviceVibration from "@/hooks/useDeviceVibration";
import { imageUrl, titleHref } from "@/lib/media";
import type { TitleCardDTO } from "@/types/dto";
import { cn } from "@/utils/helpers";
import { Chip, Image, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useDisclosure, useHover } from "@mantine/hooks";
import Link from "next/link";
import { useCallback } from "react";
import { useLongPress } from "use-long-press";
import HoverCard from "./HoverCard";

interface PosterCardProps {
  title: TitleCardDTO;
  /** Trong lưới (grid) poster co giãn theo cột; trong carousel có chiều cao cố định */
  layout?: "carousel" | "grid";
}

const PosterCard: React.FC<PosterCardProps> = ({ title, layout = "carousel" }) => {
  const { hovered, ref } = useHover<HTMLAnchorElement>();
  const [opened, handlers] = useDisclosure(false);
  const { mobile } = useBreakpoints();
  const { startVibration } = useDeviceVibration();
  const tv = title.type === "tv";

  const callback = useCallback(() => {
    handlers.open();
    setTimeout(() => startVibration([100]), 300);
  }, [handlers, startVibration]);

  const longPress = useLongPress(mobile ? callback : null, { cancelOnMovement: true, threshold: 300 });

  return (
    <>
      <Tooltip
        isDisabled={mobile}
        showArrow
        className="bg-secondary-background p-0"
        shadow="lg"
        delay={800}
        placement="right-start"
        content={<HoverCard title={title} />}
      >
        <Link href={titleHref(title)} prefetch={false} ref={ref} {...longPress()} className="block">
          <div
            className={cn(
              "group motion-preset-focus relative aspect-2/3 overflow-hidden rounded-lg border-[3px] border-transparent text-white transition-colors",
              tv ? "hover:border-warning" : "hover:border-primary",
              layout === "carousel" ? "h-[250px] md:h-[300px]" : "w-full",
            )}
          >
            {hovered && (
              <Icon icon="line-md:play-filled" width="64" height="64" className="absolute-center z-20 text-white" />
            )}
            <div className="absolute top-2 left-2 z-20 flex flex-col items-start gap-1">
              {title.quality && (
                <Chip size="sm" radius="sm" variant="solid" color={tv ? "warning" : "primary"} classNames={{ content: "font-bold" }}>
                  {title.quality}
                </Chip>
              )}
              {title.ageRating === "T18" && (
                <Chip color="danger" size="sm" radius="sm" variant="solid">
                  18+
                </Chip>
              )}
            </div>
            {tv && title.episodeLabel && (
              <Chip
                size="sm"
                radius="sm"
                className="absolute top-2 right-2 z-20 bg-black/60 text-white backdrop-blur-xs"
              >
                {title.episodeLabel}
              </Chip>
            )}
            <div className="absolute bottom-0 z-2 h-1/2 w-full bg-linear-to-t from-black from-1%" />
            <div className="absolute bottom-0 z-3 flex w-full flex-col gap-1 px-4 py-3">
              <h6 className="truncate text-sm font-semibold">{title.title}</h6>
              <div className="flex justify-between text-xs">
                <p>{title.year ?? ""}</p>
                {title.rating > 0 && <Rating rate={title.rating} />}
              </div>
            </div>
            <Image
              alt={title.title}
              src={imageUrl(title.poster)}
              radius="none"
              loading="lazy"
              removeWrapper
              className="z-0 aspect-2/3 size-full object-cover object-center transition group-hover:scale-110 group-hover:opacity-70"
            />
          </div>
        </Link>
      </Tooltip>

      {mobile && (
        <VaulDrawer backdrop="blur" open={opened} onOpenChange={handlers.toggle} title={title.title} hiddenTitle>
          <HoverCard title={title} fullWidth />
        </VaulDrawer>
      )}
    </>
  );
};

export default PosterCard;
