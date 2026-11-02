"use client";

import { useState, useTransition } from "react";
import { Button, Checkbox, Image, Input, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { searchTmdbAction } from "@/actions/admin/titles";
import type { TmdbSearchItem } from "@/server/admin/tmdb";

interface TmdbSearchProps {
  type: "movie" | "tv";
  initialQuery?: string;
  actionLabel: string;
  /** Hiện tuỳ chọn "thay ảnh bìa" (khi cập nhật phim đã có) */
  showReplaceImages?: boolean;
  onPick: (item: TmdbSearchItem, replaceImages: boolean) => Promise<unknown> | void;
}

/** Tìm phim trên TMDB và chọn kết quả để import/cập nhật. */
const TmdbSearch: React.FC<TmdbSearchProps> = ({ type, initialQuery = "", actionLabel, showReplaceImages, onPick }) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<TmdbSearchItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [picking, setPicking] = useState<number | null>(null);
  const [replaceImages, setReplaceImages] = useState(false);

  const search = () =>
    startSearch(async () => {
      setError(null);
      const result = await searchTmdbAction(query, type);
      if (result.success) setResults(result.data ?? []);
      else setError(result.message ?? "Lỗi tìm kiếm");
    });

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <Input
          value={query}
          onValueChange={setQuery}
          placeholder={type === "tv" ? "Tên phim bộ (tiếng Việt hoặc tiếng Anh)..." : "Tên phim (tiếng Việt hoặc tiếng Anh)..."}
          startContent={<Icon icon="mdi:magnify" fontSize={20} />}
          autoFocus
        />
        <Button type="submit" color="primary" isLoading={searching}>
          Tìm
        </Button>
      </form>
      {showReplaceImages && (
        <Checkbox size="sm" isSelected={replaceImages} onValueChange={setReplaceImages}>
          Thay poster / ảnh nền / logo hiện tại bằng ảnh từ TMDB
        </Checkbox>
      )}
      {error && <p className="text-danger text-sm">{error}</p>}
      {searching && <Spinner className="py-6" />}
      {results && !searching && (
        <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto pr-1">
          {results.length === 0 && <p className="text-foreground-500 py-6 text-center text-sm">Không tìm thấy kết quả.</p>}
          {results.map((item) => (
            <div key={item.id} className="bg-default-100 flex gap-3 rounded-xl p-2">
              <Image
                src={item.poster ?? "/images/no-poster.svg"}
                alt={item.title}
                className="aspect-2/3 w-16 shrink-0 object-cover"
                radius="sm"
                removeWrapper
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="font-semibold">
                  {item.title} {item.year && <span className="text-foreground-500 font-normal">({item.year})</span>}
                </p>
                {item.originalTitle !== item.title && <p className="text-foreground-500 text-xs">{item.originalTitle}</p>}
                <p className="text-foreground-500 line-clamp-2 text-xs">{item.overview || "Chưa có mô tả."}</p>
              </div>
              <Button
                size="sm"
                color="primary"
                variant="flat"
                className="shrink-0 self-center"
                isLoading={picking === item.id}
                isDisabled={picking !== null && picking !== item.id}
                onPress={async () => {
                  setPicking(item.id);
                  try {
                    await onPick(item, replaceImages);
                  } finally {
                    setPicking(null);
                  }
                }}
              >
                {actionLabel}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TmdbSearch;
