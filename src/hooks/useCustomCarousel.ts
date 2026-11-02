"use client";

import useEmblaCarousel from "embla-carousel-react";
import { EmblaOptionsType, EmblaPluginType } from "embla-carousel";
import { useCallback, useEffect, useState } from "react";

/**
 * Custom hook bọc Embla Carousel: trả về ref gắn vào viewport, các hàm cuộn
 * và trạng thái có thể cuộn trái/phải (cập nhật theo sự kiện của embla).
 */
export const useCustomCarousel = (options?: EmblaOptionsType, plugins?: EmblaPluginType[]) => {
  const [emblaRef, embla] = useEmblaCarousel(options, plugins);

  const [canScrollNext, setCanScrollNext] = useState(true);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollTo = useCallback((index: number) => embla && embla.scrollTo(index), [embla]);
  const scrollPrev = useCallback(() => embla && embla.scrollPrev(), [embla]);
  const scrollNext = useCallback(() => embla && embla.scrollNext(), [embla]);

  useEffect(() => {
    if (!embla) return;
    const update = () => {
      setCanScrollPrev(embla.canScrollPrev());
      setCanScrollNext(embla.canScrollNext());
      setSelectedIndex(embla.selectedScrollSnap());
    };
    embla.on("init", update).on("reInit", update).on("select", update);
    return () => {
      embla.off("init", update).off("reInit", update).off("select", update);
    };
  }, [embla]);

  return { emblaRef, scrollTo, scrollNext, scrollPrev, selectedIndex, canScrollNext, canScrollPrev };
};
