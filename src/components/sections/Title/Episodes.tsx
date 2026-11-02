"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardBody, Chip, Image, Input, Tab, Tabs } from "@heroui/react";
import { formatDate, formatRuntime } from "@/lib/format";
import { episodeHref, imageUrl } from "@/lib/media";
import type { EpisodeDTO, SeasonDTO } from "@/types/dto";
import { cn } from "@/utils/helpers";
import { PlayOutline, Search } from "@/utils/icons";
import SectionTitle from "@/components/ui/other/SectionTitle";

interface EpisodesProps {
  slug: string;
  seasons: SeasonDTO[];
  current?: { season: number; episode: number } | null;
  compact?: boolean;
  onNavigate?: () => void;
}

export const EpisodeCard: React.FC<{
  slug: string;
  season: number;
  episode: EpisodeDTO;
  active?: boolean;
  compact?: boolean;
  onNavigate?: () => void;
}> = ({ slug, season, episode, active, compact, onNavigate }) => {
  const href = episode.playable ? episodeHref(slug, season, episode.number) : undefined;
  const body = (
    <Card
      shadow="none"
      className={cn(
        "group border-foreground-200 bg-foreground-100 grid grid-cols-[auto_1fr] gap-3 border-2 transition-colors",
        episode.playable ? "hover:border-warning hover:bg-foreground-200" : "cursor-not-allowed opacity-50",
        active && "border-warning bg-warning/10",
      )}
    >
      <div className="relative">
        <Image
          alt={episode.name ?? `Tập ${episode.number}`}
          src={imageUrl(episode.still, "/images/no-poster.svg")}
          radius="none"
          className={cn("aspect-video rounded-l-xl object-cover", compact ? "w-32" : "w-40 md:w-56")}
        />
        {episode.playable && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100">
              <PlayOutline className="h-5 w-5 text-white" />
            </div>
          </div>
        )}
        <Chip size="sm" className="absolute bottom-2 left-2 z-20 min-w-9 bg-black/50 text-center text-white backdrop-blur-xs">
          {episode.number}
        </Chip>
        {!episode.playable && (
          <Chip size="sm" color="warning" variant="shadow" className="absolute top-2 right-2 z-20">
            Sắp có
          </Chip>
        )}
      </div>
      <CardBody className="flex justify-center gap-1 py-2 pl-0">
        <p className={cn("line-clamp-1 font-semibold transition-colors", compact ? "text-sm" : "text-base md:text-lg", episode.playable && "group-hover:text-warning")}>
          Tập {episode.number}
          {episode.name ? `: ${episode.name}` : ""}
        </p>
        <p className="text-foreground-500 text-xs">
          {[episode.runtime ? formatRuntime(episode.runtime) : null, formatDate(episode.airDate)].filter(Boolean).join(" • ")}
        </p>
        {!compact && episode.overview && (
          <p className="text-foreground-500 line-clamp-2 text-sm" title={episode.overview}>
            {episode.overview}
          </p>
        )}
      </CardBody>
    </Card>
  );

  return href ? (
    <Link href={href} prefetch={false} onClick={onNavigate} scroll={false}>
      {body}
    </Link>
  ) : (
    body
  );
};

const Episodes: React.FC<EpisodesProps> = ({ slug, seasons, current, compact, onNavigate }) => {
  const [season, setSeason] = useState(String(current?.season ?? seasons[0]?.number ?? 1));
  const [query, setQuery] = useState("");

  const episodes = useMemo(() => {
    const list = seasons.find((s) => String(s.number) === season)?.episodes ?? [];
    const q = query.trim().toLowerCase();
    return q ? list.filter((e) => `${e.number} ${e.name ?? ""}`.toLowerCase().includes(q)) : list;
  }, [seasons, season, query]);

  if (!seasons.length) {
    return <p className="text-foreground-500 py-8 text-center">Phim chưa có tập nào.</p>;
  }

  return (
    <section id="episodes" className="z-3 flex flex-col gap-3">
      {!compact && <SectionTitle color="warning">Danh sách tập</SectionTitle>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {seasons.length > 1 ? (
          <Tabs
            color="warning"
            variant="underlined"
            selectedKey={season}
            onSelectionChange={(key) => setSeason(String(key))}
            classNames={{ tabList: "flex-wrap" }}
          >
            {seasons.map((s) => (
              <Tab key={String(s.number)} title={s.name || `Phần ${s.number}`} />
            ))}
          </Tabs>
        ) : (
          <p className="text-foreground-500 text-sm">{episodes.length} tập</p>
        )}
        <Input
          size="sm"
          className="max-w-56"
          placeholder="Tìm tập..."
          value={query}
          onValueChange={setQuery}
          startContent={<Search className="text-foreground-400" />}
          isClearable
          onClear={() => setQuery("")}
        />
      </div>
      <div className={cn("grid gap-2", !compact && "md:grid-cols-2 md:gap-3")}>
        {episodes.map((episode) => (
          <EpisodeCard
            key={episode.id}
            slug={slug}
            season={Number(season)}
            episode={episode}
            compact={compact}
            onNavigate={onNavigate}
            active={current?.season === Number(season) && current?.episode === episode.number}
          />
        ))}
      </div>
    </section>
  );
};

export default Episodes;
