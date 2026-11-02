"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, Pagination, Select, SelectItem, Spinner } from "@heroui/react";
import type { GenreDTO } from "@/types/dto";

type Options = { genres: GenreDTO[]; countries: string[]; years: number[] };

const SORT_OPTIONS = [
  { key: "latest", label: "Mới cập nhật" },
  { key: "views", label: "Xem nhiều" },
  { key: "rating", label: "Đánh giá cao" },
  { key: "year", label: "Năm phát hành" },
  { key: "title", label: "Tên A-Z" },
];

const TYPE_OPTIONS = [
  { key: "", label: "Tất cả" },
  { key: "movie", label: "Phim lẻ" },
  { key: "tv", label: "Phim bộ" },
];

const useQueryUpdater = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = (changes: Record<string, string | null>, resetPage = true) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    if (resetPage) params.delete("page");
    startTransition(() => router.push(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false }));
  };
  return { update, pending, searchParams };
};

export const DiscoverFilters: React.FC<{ options: Options; hideType?: boolean }> = ({ options, hideType }) => {
  const { update, pending, searchParams } = useQueryUpdater();
  const value = (key: string) => searchParams.get(key) ?? "";
  const hasFilter = ["type", "genre", "country", "year", "sort"].some((k) => searchParams.has(k));

  const select = (key: string, label: string, items: { key: string; label: string }[]) => (
    <Select
      size="sm"
      label={label}
      className="min-w-36 flex-1 sm:max-w-48"
      selectedKeys={value(key) ? [value(key)] : []}
      onSelectionChange={(keys) => update({ [key]: (Array.from(keys)[0] as string) ?? null })}
      items={items}
    >
      {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
    </Select>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!hideType && select("type", "Loại phim", TYPE_OPTIONS.filter((t) => t.key))}
      {select("genre", "Thể loại", options.genres.map((g) => ({ key: g.slug, label: g.name })))}
      {select("country", "Quốc gia", options.countries.map((c) => ({ key: c, label: c })))}
      {select("year", "Năm", options.years.map((y) => ({ key: String(y), label: String(y) })))}
      {select("sort", "Sắp xếp", SORT_OPTIONS)}
      {hasFilter && (
        <Button
          variant="light"
          size="sm"
          onPress={() => update({ type: null, genre: null, country: null, year: null, sort: null })}
        >
          Xoá bộ lọc
        </Button>
      )}
      {pending && <Spinner size="sm" />}
    </div>
  );
};

export const DiscoverPagination: React.FC<{ page: number; pageCount: number }> = ({ page, pageCount }) => {
  const { update } = useQueryUpdater();
  if (pageCount <= 1) return null;
  return (
    <div className="flex justify-center py-6">
      <Pagination
        showControls
        total={pageCount}
        page={page}
        onChange={(p) => {
          update({ page: p > 1 ? String(p) : null }, false);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </div>
  );
};
