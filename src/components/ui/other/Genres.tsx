"use client";

import { Chip, ChipProps, Link } from "@heroui/react";
import type { GenreDTO } from "@/types/dto";

export interface GenresProps {
  genres: GenreDTO[];
  chipProps?: Omit<ChipProps, "children" | "as" | "href" | "key">;
}

const Genres: React.FC<GenresProps> = ({ genres, chipProps = { size: "sm", variant: "flat", radius: "full" } }) => (
  <div className="flex flex-wrap gap-2">
    {genres.map(({ slug, name }) => (
      <Chip as={Link} href={`/discover?genre=${slug}`} key={slug} {...chipProps}>
        {name}
      </Chip>
    ))}
  </div>
);

export default Genres;
