"use client";

import { Button, Chip, Image, User } from "@heroui/react";
import { useWindowScroll } from "@mantine/hooks";
import Link from "next/link";
import { FaCirclePlay } from "react-icons/fa6";
import BookmarkButton from "@/components/ui/button/BookmarkButton";
import ShareButton from "@/components/ui/button/ShareButton";
import Genres from "@/components/ui/other/Genres";
import Rating from "@/components/ui/other/Rating";
import SectionTitle from "@/components/ui/other/SectionTitle";
import Trailer from "@/components/ui/overlay/Trailer";
import Carousel from "@/components/ui/wrapper/Carousel";
import { formatCount, formatDate, formatRuntime } from "@/lib/format";
import { imageUrl } from "@/lib/media";
import type { PersonCreditDTO, TitleDetailDTO } from "@/types/dto";
import { Calendar, Clock, Eye } from "@/utils/icons";
import { AgeChip, TypeChip } from "./Badges";

export const DetailBackdrop: React.FC<{ title: TitleDetailDTO }> = ({ title }) => {
  const [{ y }] = useWindowScroll();
  const opacity = Math.min((y / 1000) * 2, 1);
  const backdrop = title.backdrop ?? title.poster;

  return (
    <section id="backdrop" className="fixed inset-0 h-[35vh] md:h-[50vh] lg:h-[70vh]">
      <div className="bg-background absolute inset-0 z-10" style={{ opacity }} />
      <div className="from-background absolute inset-0 z-2 bg-linear-to-b from-1% via-transparent via-30%" />
      <div className="from-background absolute inset-0 z-2 translate-y-px bg-linear-to-t from-1% via-transparent via-55%" />
      {title.logo && (
        <Image
          isBlurred
          radius="none"
          alt={title.title}
          classNames={{ wrapper: "absolute-center z-1 bg-transparent" }}
          className="max-h-[20vh] w-[25vh] max-w-80 object-contain drop-shadow-xl md:w-[60vh]"
          src={title.logo}
        />
      )}
      {backdrop && (
        <img
          alt={title.title}
          className="z-0 h-[35vh] w-screen object-cover object-center md:h-[50vh] lg:h-[70vh]"
          src={backdrop}
        />
      )}
    </section>
  );
};

const InfoRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) =>
  children ? (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-sm">
      <span className="text-foreground-500">{label}</span>
      <span>{children}</span>
    </div>
  ) : null;

export const DetailOverview: React.FC<{ title: TitleDetailDTO; saved: boolean }> = ({ title, saved }) => {
  const tv = title.type === "tv";
  const names = (people: PersonCreditDTO[]) => people.map((p) => p.name).join(", ");

  return (
    <section id="overview" className="relative z-3 flex flex-col gap-8 pt-[20vh] md:pt-[40vh]">
      <div className="md:grid md:grid-cols-[auto_1fr] md:gap-6">
        <Image
          shadow="lg"
          alt={title.title}
          classNames={{ wrapper: "w-52 max-h-min aspect-2/3 hidden md:block" }}
          className="aspect-2/3 object-cover object-center"
          src={imageUrl(title.poster)}
        />

        <div className="flex flex-col gap-8">
          <div id="title" className="flex flex-col gap-1 md:gap-2">
            <div className="flex flex-wrap gap-2">
              <TypeChip type={title.type} size="md" />
              <AgeChip rating={title.ageRating} size="md" />
              {title.quality && (
                <Chip color="success" variant="faded">
                  {title.quality}
                </Chip>
              )}
            </div>
            <h2 className="text-2xl font-black md:text-4xl">{title.title}</h2>
            {title.originalTitle && title.originalTitle !== title.title && (
              <p className="text-foreground-500">{title.originalTitle}</p>
            )}
            <div className="flex flex-wrap items-center gap-1 text-xs md:gap-2 md:text-base">
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
                  <Rating rate={title.rating} count={title.voteCount} />
                </>
              )}
              {title.viewCount > 0 && (
                <>
                  <p>&#8226;</p>
                  <div className="flex items-center gap-1">
                    <Eye />
                    <span>{formatCount(title.viewCount)} lượt xem</span>
                  </div>
                </>
              )}
            </div>
            <Genres genres={title.genres} />
          </div>

          <div id="action" className="flex w-full flex-wrap justify-between gap-4 md:gap-0">
            <div className="flex flex-wrap gap-2">
              <Button
                as={Link}
                href={title.playHref ?? "#"}
                prefetch={false}
                color={tv ? "warning" : "primary"}
                variant="shadow"
                isDisabled={!title.playable}
                startContent={<FaCirclePlay size={22} />}
              >
                {title.playable ? (tv ? "Xem từ tập đầu" : "Xem phim") : "Sắp ra mắt"}
              </Button>
              <Trailer url={title.trailerUrl} title={title.title} />
            </div>
            <div className="flex flex-wrap gap-2">
              <ShareButton slug={title.slug} title={title.title} type={title.type} />
              <BookmarkButton titleId={title.id} initialSaved={saved} />
            </div>
          </div>

          <div id="story" className="flex flex-col gap-2">
            <SectionTitle color={tv ? "warning" : "primary"}>Nội dung phim</SectionTitle>
            {title.tagline && <p className="text-foreground-500 italic">“{title.tagline}”</p>}
            <p className="text-sm leading-relaxed whitespace-pre-line md:text-base">
              {title.overview || "Nội dung đang được cập nhật."}
            </p>
          </div>

          <div id="info" className="flex flex-col gap-2">
            <InfoRow label="Đạo diễn">{names(title.directors)}</InfoRow>
            <InfoRow label="Biên kịch">{names(title.writers)}</InfoRow>
            <InfoRow label="Quốc gia">{title.country}</InfoRow>
            <InfoRow label="Khởi chiếu">{formatDate(title.releaseDate)}</InfoRow>
            {tv && (
              <InfoRow label="Trạng thái">
                {title.seriesStatus === "completed" ? "Hoàn tất" : "Đang cập nhật"}
                {title.totalEpisodes ? ` • ${title.totalEpisodes} tập` : ""}
              </InfoRow>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export const DetailCast: React.FC<{ cast: PersonCreditDTO[]; color?: "primary" | "warning" }> = ({ cast, color }) => {
  if (!cast.length) return null;
  return (
    <section id="casts" className="z-3 flex flex-col gap-2">
      <SectionTitle color={color}>Diễn viên</SectionTitle>
      <Carousel classNames={{ container: "gap-5" }}>
        {cast.map((person) => (
          <div key={person.id} className="flex max-w-fit items-center px-1 py-2">
            <User
              name={person.name}
              description={person.character}
              avatarProps={{ src: person.profile ?? undefined, size: "lg", showFallback: true, isBordered: true, name: person.name }}
            />
          </div>
        ))}
      </Carousel>
    </section>
  );
};
