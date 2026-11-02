"use client";

import { Chip, ChipProps } from "@heroui/react";
import type { ContentType } from "@/types/dto";

export const TypeChip: React.FC<{ type: ContentType } & Omit<ChipProps, "children">> = ({ type, ...props }) => (
  <Chip
    size="sm"
    color={type === "tv" ? "warning" : "primary"}
    variant="faded"
    classNames={{ content: "font-bold" }}
    {...props}
  >
    {type === "tv" ? "Phim bộ" : "Phim lẻ"}
  </Chip>
);

export const AgeChip: React.FC<{ rating: string | null } & Omit<ChipProps, "children">> = ({ rating, ...props }) =>
  rating ? (
    <Chip size="sm" color={rating === "T18" ? "danger" : rating === "T16" ? "warning" : "default"} variant="faded" {...props}>
      {rating}
    </Chip>
  ) : null;
