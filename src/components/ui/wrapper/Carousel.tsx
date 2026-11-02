"use client";

import { useCustomCarousel } from "@/hooks/useCustomCarousel";
import { ScrollShadow } from "@heroui/react";
import IconButton from "../button/IconButton";
import { EmblaOptionsType, EmblaPluginType } from "embla-carousel";
import { cn } from "@/utils/helpers";
import styles from "@/styles/embla-carousel.module.css";
import { ChevronLeft, ChevronRight } from "@/utils/icons";

export interface CarouselProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  withScrollShadow?: boolean;
  isButtonDisabled?: boolean;
  autoHideButton?: boolean;
  options?: EmblaOptionsType;
  plugins?: EmblaPluginType[];
  classNames?: {
    container?: string;
    viewport?: string;
    wrapper?: string;
  };
}

const Carousel = ({
  children,
  withScrollShadow = true,
  isButtonDisabled = false,
  autoHideButton = true,
  options = { dragFree: true, slidesToScroll: "auto" },
  plugins,
  classNames,
  ...props
}: CarouselProps) => {
  const { emblaRef, canScrollPrev, canScrollNext, scrollPrev, scrollNext } = useCustomCarousel(options, plugins);

  const getVisibility = () => {
    if (canScrollPrev && canScrollNext) return "both";
    if (canScrollPrev) return "left";
    if (canScrollNext) return "right";
    return "none";
  };

  return (
    <ScrollShadow
      isEnabled={withScrollShadow}
      orientation="horizontal"
      visibility={getVisibility()}
      size={40}
      hideScrollBar
    >
      <div
        {...props}
        className={cn(styles.wrapper, classNames?.wrapper, {
          "relative flex w-full flex-col justify-center": !isButtonDisabled,
        })}
      >
        {!isButtonDisabled && (
          <>
            <div
              className={cn("absolute z-10 h-full", {
                "hidden md:block": autoHideButton,
              })}
            >
              <IconButton
                onPress={scrollPrev}
                size="lg"
                radius="none"
                disableRipple
                icon={<ChevronLeft size={24} />}
                className={cn("h-full bg-transparent", {
                  hidden: !canScrollPrev,
                })}
              />
            </div>
            <div
              className={cn("absolute z-10 h-full place-self-end", {
                "hidden md:block": autoHideButton,
              })}
            >
              <IconButton
                onPress={scrollNext}
                size="lg"
                radius="none"
                disableRipple
                icon={<ChevronRight size={24} />}
                className={cn("h-full bg-transparent", {
                  hidden: !canScrollNext,
                })}
              />
            </div>
          </>
        )}
        <div className={cn(styles.viewport, classNames?.viewport)} ref={emblaRef}>
          <div className={cn(styles.container, classNames?.container)}>{children}</div>
        </div>
      </div>
    </ScrollShadow>
  );
};

export default Carousel;
