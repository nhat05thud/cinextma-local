"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDebouncedValue } from "@mantine/hooks";
import SearchInput from "@/components/ui/input/SearchInput";

/** Ô tìm kiếm: cập nhật ?q= (có debounce) để server render lại kết quả. */
const SearchBox: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const [debounced] = useDebouncedValue(value, 400);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    const q = debounced.trim();
    if (q === (searchParams.get("q") ?? "")) return;
    startTransition(() => router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname, { scroll: false }));
  }, [debounced, pathname, router, searchParams]);

  return (
    <SearchInput
      ref={inputRef}
      size="lg"
      value={value}
      isLoading={pending}
      onValueChange={setValue}
      isClearable
      onClear={() => setValue("")}
      placeholder="Nhập tên phim, tên gốc hoặc diễn viên (gõ không dấu cũng được)..."
    />
  );
};

export default SearchBox;
