"use client";

import Genres from "@/components/ui/other/Genres";
import Rating from "@/components/ui/other/Rating";
import { formatRuntime } from "@/lib/format";
import { titleHref } from "@/lib/media";
import type { TitleCardDTO } from "@/types/dto";
import { cn } from "@/utils/helpers";
import { Calendar, Clock } from "@/utils/icons";
import { Button, Chip, Image } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import { TypeChip } from "./Badges";

const HoverCard: React.FC<{ title: TitleCardDTO; fullWidth?: boolean }> = ({ title, fullWidth }) => {
  const tv = title.type === "tv";
  const backdrop = title.backdrop ?? title.poster;

  return (
    <div className={cn("w-80", { "w-full": fullWidth })}>
      <div className="relative">
        <div className="absolute aspect-video h-fit w-full">
          <div className="from-secondary-background absolute z-2 h-full w-full bg-linear-to-t from-1%" />
          {title.logo && (
            <Image
              isBlurred
              radius="none"
              alt={title.title}
              classNames={{ wrapper: "absolute-center z-1 bg-transparent" }}
              className="h-full max-h-32 w-full object-contain drop-shadow-xl"
              src={title.logo}
            />
          )}
          {backdrop && (
            <Image
              radius="none"
              alt={title.title}
              className="z-0 aspect-video rounded-t-lg object-cover object-center"
              src={backdrop}
            />
          )}
        </div>
        <div className="flex flex-col gap-2 p-4 pt-[40%] *:z-10">
          <div className="flex flex-wrap gap-2">
            <TypeChip type={title.type} />
            {title.ageRating && (
              <Chip size="sm" color={title.ageRating === "T18" ? "danger" : "default"} variant="faded">
                {title.ageRating}
              </Chip>
            )}
            {title.quality && (
              <Chip size="sm" color="success" variant="faded">
                {title.quality}
              </Chip>
            )}
          </div>
          <h4 className="text-xl font-bold">{title.title}</h4>
          {title.originalTitle && title.originalTitle !== title.title && (
            <p className="text-foreground-500 -mt-1 text-sm">{title.originalTitle}</p>
          )}
          <div className="flex flex-wrap items-center gap-1 text-xs md:text-sm">
            <div className="flex items-center gap-1">
              <Clock />
              <span>{tv ? title.episodeLabel : formatRuntime(title.runtime)}</span>
            </div>
            {title.year && (
              <>
                <p>&#8226;</p>
                <div className="flex items-center gap-1">
                  <Calendar />
                  <span>{title.year}</span>
                </div>
              </>
            )}
            {title.rating > 0 && (
              <>
                <p>&#8226;</p>
                <Rating rate={title.rating} />
              </>
            )}
          </div>
          <Genres genres={title.genres.slice(0, 4)} />
          <div className="flex w-full gap-2 py-1">
            <Button
              as={Link}
              href={title.playHref ?? titleHref(title)}
              fullWidth
              color={tv ? "warning" : "primary"}
              variant="shadow"
              isDisabled={!title.playable}
              startContent={<Icon icon="solar:play-circle-bold" fontSize={24} />}
            >
              {title.playable ? "Xem ngay" : "Sắp ra mắt"}
            </Button>
            <Button as={Link} href={titleHref(title)} variant="faded" isIconOnly title="Chi tiết">
              <Icon icon="mdi:information-outline" fontSize={22} />
            </Button>
          </div>
          {title.overview && <p className="line-clamp-4 text-sm">{title.overview}</p>}
        </div>
      </div>
    </div>
  );
};

export default HoverCard;
