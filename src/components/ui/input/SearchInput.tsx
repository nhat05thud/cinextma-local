"use client";

import { useRef } from "react";
import { FaSearch } from "react-icons/fa";
import { Input, InputProps, Kbd, Spinner } from "@heroui/react";
import { cn } from "@/utils/helpers";
import { useHotkeys, useMergedRef } from "@mantine/hooks";
import { usePathname, useRouter } from "next/navigation";

interface SearchInputProps extends InputProps {
  isLoading?: boolean;
  ref?: React.Ref<HTMLInputElement>;
}

const SearchInput: React.FC<SearchInputProps> = ({
  className,
  isLoading,
  placeholder = "Tìm kiếm...",
  ref,
  ...props
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const mergedRef = useMergedRef(inputRef, ref);
  const router = useRouter();
  const pathName = usePathname();

  useHotkeys([
    [
      "ctrl+K",
      () => {
        if (pathName !== "/search") return router.push("/search");
        inputRef.current?.focus();
      },
      { preventDefault: true },
    ],
  ]);

  return (
    <Input
      ref={mergedRef}
      autoComplete="off"
      className={cn(className, "w-full")}
      placeholder={placeholder}
      radius="full"
      classNames={{ inputWrapper: "bg-secondary-background", input: "text-sm" }}
      aria-label="Tìm kiếm"
      type="search"
      labelPlacement="outside"
      endContent={!props.value && <Kbd className="hidden md:inline-block">CTRL+K</Kbd>}
      startContent={
        <div className="text-default-400 pointer-events-none flex shrink-0 items-center pr-1">
          {isLoading ? <Spinner color="default" size="sm" /> : <FaSearch />}
        </div>
      }
      {...props}
    />
  );
};

export default SearchInput;
