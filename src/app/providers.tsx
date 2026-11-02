"use client";

import { PropsWithChildren } from "react";
import { HeroUIProvider, ToastProvider } from "@heroui/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProgressProvider as ProgressProvider } from "@bprogress/next";
import { usePathname, useRouter } from "next/navigation";
import { addCollection, type IconifyJSON } from "@iconify/react";
import iconBundle from "@/lib/iconify-bundle.json";

// Icon đóng gói sẵn (npm run icons:sync) -> không cần gọi api.iconify.design, chạy được khi không có internet
for (const collection of iconBundle as unknown as IconifyJSON[]) addCollection(collection);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      refetchOnWindowFocus: false,
    },
  },
});

export default function Providers({ children }: PropsWithChildren) {
  const { push } = useRouter();
  const pathName = usePathname();
  const tv = pathName.startsWith("/tv/") || pathName.startsWith("/series");

  return (
    <QueryClientProvider client={queryClient}>
      <HeroUIProvider navigate={push} locale="vi-VN">
        <ToastProvider
          placement="top-right"
          maxVisibleToasts={3}
          toastOffset={10}
          toastProps={{
            shouldShowTimeoutProgress: true,
            timeout: 4000,
            classNames: {
              content: "mr-7",
              closeButton: "opacity-100 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-auto",
            },
          }}
        />
        <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem>
          <ProgressProvider options={{ showSpinner: false }} color={`hsl(var(--heroui-${tv ? "warning" : "primary"}))`}>
            {children}
          </ProgressProvider>
        </NextThemesProvider>
      </HeroUIProvider>
    </QueryClientProvider>
  );
}
