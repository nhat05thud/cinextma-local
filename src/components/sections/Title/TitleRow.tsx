"use client";

import SectionTitle from "@/components/ui/other/SectionTitle";
import Carousel from "@/components/ui/wrapper/Carousel";
import type { HomeRowDTO } from "@/types/dto";
import { Link } from "@heroui/react";
import PosterCard from "./PosterCard";

const TitleRow: React.FC<{ row: HomeRowDTO; color?: "primary" | "warning" }> = ({ row, color = "primary" }) => (
  <section id={row.key} className="z-3 flex flex-col gap-2">
    <div className="flex grow items-center justify-between">
      <SectionTitle color={color}>{row.name}</SectionTitle>
      {row.href && (
        <Link size="sm" href={row.href} isBlock color="foreground" className="rounded-full">
          Xem tất cả &gt;
        </Link>
      )}
    </div>
    <Carousel>
      {row.items.map((title) => (
        <div key={title.id} className="embla__slide flex min-h-fit max-w-fit items-center px-1 py-2">
          <PosterCard title={title} />
        </div>
      ))}
    </Carousel>
  </section>
);

export default TitleRow;
