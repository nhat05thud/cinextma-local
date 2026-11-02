"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { Button, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import Link from "next/link";
import Rating from "@/components/ui/other/Rating";
import { TypeChip, AgeChip } from "@/components/sections/Title/Badges";
import { formatRuntime } from "@/lib/format";
import { titleHref } from "@/lib/media";
import type { TitleCardDTO } from "@/types/dto";
import { cn } from "@/utils/helpers";

const HeroSlider: React.FC<{ titles: TitleCardDTO[] }> = ({ titles }) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: titles.length > 1 }, [
    Autoplay({ delay: 7000, stopOnInteraction: false, stopOnMouseEnter: true }),
  ]);
  const [selected, setSelected] = useState(0);

  const onSelect = useCallback(() => emblaApi && setSelected(emblaApi.selectedScrollSnap()), [emblaApi]);
  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    return () => void emblaApi.off("select", onSelect);
  }, [emblaApi, onSelect]);

  if (!titles.length) return null;

  return (
    // Tràn lên dưới navbar (h-16) và bỏ padding của <main> (py-8, px-3 / sm:px-5)
    <section className="relative -mx-3 -mt-24 sm:-mx-5">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {titles.map((title, index) => {
            const tv = title.type === "tv";
            const image = title.backdrop ?? title.poster;
            return (
              <div key={title.id} className="relative h-[68vh] min-h-[420px] min-w-0 flex-[0_0_100%] md:h-[85vh]">
                {image && (
                  <img
                    src={image}
                    alt={title.title}
                    loading={index === 0 ? "eager" : "lazy"}
                    className={cn(
                      "absolute inset-0 size-full object-cover object-center transition-transform duration-[8000ms] ease-out",
                      selected === index ? "scale-105" : "scale-100",
                    )}
                  />
                )}
                <div className="from-background absolute inset-0 bg-linear-to-t from-1% via-transparent via-50%" />
                <div className="from-background/90 absolute inset-0 bg-linear-to-r via-transparent via-60%" />
                <div className="from-background/60 absolute inset-x-0 top-0 h-32 bg-linear-to-b" />

                <div
                  className={cn(
                    "absolute bottom-[10%] left-4 flex max-w-2xl flex-col gap-3 pr-4 md:left-12 lg:left-16",
                    selected === index ? "motion-preset-slide-up motion-duration-700" : "opacity-0",
                  )}
                >
                  {title.logo ? (
                    <img src={title.logo} alt={title.title} className="max-h-28 w-fit max-w-[70%] object-contain object-left drop-shadow-xl md:max-h-36" />
                  ) : (
                    <h2 className="text-3xl font-black drop-shadow-lg md:text-5xl">{title.title}</h2>
                  )}
                  {title.originalTitle && title.originalTitle !== title.title && (
                    <p className="text-foreground-600 -mt-1 text-sm md:text-base">{title.originalTitle}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <TypeChip type={title.type} />
                    <AgeChip rating={title.ageRating} />
                    {title.quality && (
                      <Chip size="sm" color="success" variant="faded">
                        {title.quality}
                      </Chip>
                    )}
                    {title.year && <span>{title.year}</span>}
                    <span>&#8226;</span>
                    <span>{tv ? title.episodeLabel : formatRuntime(title.runtime)}</span>
                    {title.rating > 0 && <Rating rate={title.rating} />}
                  </div>
                  {title.genres.length > 0 && (
                    <p className="text-foreground-600 text-sm">{title.genres.map((g) => g.name).join(" • ")}</p>
                  )}
                  {title.overview && (
                    <p className="text-foreground-700 line-clamp-3 max-w-xl text-sm md:text-base">{title.overview}</p>
                  )}
                  <div className="flex gap-3 pt-1">
                    <Button
                      as={Link}
                      href={title.playHref ?? titleHref(title)}
                      size="lg"
                      color={tv ? "warning" : "primary"}
                      variant="shadow"
                      isDisabled={!title.playable}
                      startContent={<Icon icon="solar:play-bold" fontSize={22} />}
                    >
                      {title.playable ? "Xem ngay" : "Sắp ra mắt"}
                    </Button>
                    <Button
                      as={Link}
                      href={titleHref(title)}
                      size="lg"
                      variant="flat"
                      className="bg-white/15 text-white backdrop-blur-md"
                      startContent={<Icon icon="mdi:information-outline" fontSize={22} />}
                    >
                      Chi tiết
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {titles.length > 1 && (
        <div className="absolute right-4 bottom-[10%] z-10 hidden gap-2 md:right-12 md:flex">
          {titles.map((title, index) => (
            <button
              key={title.id}
              type="button"
              aria-label={`Chuyển tới ${title.title}`}
              onClick={() => emblaApi?.scrollTo(index)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                selected === index ? "bg-primary w-8" : "w-4 bg-white/40 hover:bg-white/70",
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default HeroSlider;
