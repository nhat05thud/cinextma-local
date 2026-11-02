"use client";

import type { HistoryDTO } from "@/types/dto";
import { formatClock, timeAgo } from "@/lib/format";
import { imageUrl } from "@/lib/media";
import { PlayOutline } from "@/utils/icons";
import { Chip, Image, Progress } from "@heroui/react";
import Link from "next/link";

const ResumeCard: React.FC<{ item: HistoryDTO; action?: React.ReactNode }> = ({ item, action }) => {
  const tv = item.title.type === "tv";
  const percent = item.completed ? 100 : item.duration > 0 ? (item.position / item.duration) * 100 : 0;

  return (
    <div className="relative">
      <Link href={item.href} prefetch={false}>
        <div className="group motion-preset-focus relative aspect-video overflow-hidden rounded-lg text-white">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="z-10 flex h-12 w-12 items-center justify-center rounded-full bg-black/35 opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100">
              <PlayOutline className="h-6 w-6 text-white" />
            </div>
          </div>
          {tv && item.episode !== null && (
            <Chip
              size="sm"
              variant="faded"
              radius="sm"
              color="warning"
              className="absolute top-2 right-2 z-20"
              classNames={{ content: "font-bold" }}
            >
              P{item.season} • Tập {item.episode}
            </Chip>
          )}
          <Chip
            radius="sm"
            size="sm"
            variant="faded"
            className="absolute top-2 left-2 z-20"
            color={item.completed ? "success" : undefined}
          >
            {item.completed ? "Đã xem hết" : `${formatClock(item.position)} / ${formatClock(item.duration)}`}
          </Chip>
          <Progress
            size="sm"
            radius="none"
            aria-label="Tiến độ xem"
            className="absolute bottom-0 z-10 w-full"
            color={tv ? "warning" : "primary"}
            value={percent}
          />
          <div className="absolute bottom-0 z-2 h-1/2 w-full bg-linear-to-t from-black from-1%" />
          <div className="absolute bottom-0 z-3 flex w-full flex-col gap-0.5 p-3 pb-4">
            <h6 className="truncate text-sm font-semibold">{item.title.title}</h6>
            <div className="flex justify-between gap-3 text-xs text-white/80">
              <p className="truncate">{item.episodeName ?? item.title.year ?? ""}</p>
              <p className="shrink-0">{timeAgo(item.updatedAt)}</p>
            </div>
          </div>
          <Image
            alt={item.title.title}
            src={imageUrl(item.image, "/images/no-poster.svg")}
            radius="none"
            removeWrapper
            className="z-0 aspect-video size-full object-cover object-center transition group-hover:scale-110 group-hover:opacity-70"
          />
        </div>
      </Link>
      {action && <div className="absolute top-10 right-2 z-30">{action}</div>}
    </div>
  );
};

export default ResumeCard;
