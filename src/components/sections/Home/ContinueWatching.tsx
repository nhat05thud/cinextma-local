"use client";

import SectionTitle from "@/components/ui/other/SectionTitle";
import Carousel from "@/components/ui/wrapper/Carousel";
import type { HistoryDTO } from "@/types/dto";
import { Link } from "@heroui/react";
import ResumeCard from "./ResumeCard";

const ContinueWatching: React.FC<{ items: HistoryDTO[] }> = ({ items }) => {
  if (!items.length) return null;
  return (
    <section id="continue-watching" className="z-3 flex flex-col gap-2">
      <div className="flex grow items-center justify-between">
        <SectionTitle color="success">Xem tiếp</SectionTitle>
        <Link size="sm" href="/library?tab=history" isBlock color="foreground" className="rounded-full">
          Lịch sử &gt;
        </Link>
      </div>
      <Carousel>
        {items.map((item) => (
          <div key={item.id} className="embla__slide flex min-h-fit max-w-fit items-center px-1 py-2">
            <div className="w-[260px] md:w-[340px]">
              <ResumeCard item={item} />
            </div>
          </div>
        ))}
      </Carousel>
    </section>
  );
};

export default ContinueWatching;
