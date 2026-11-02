"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { addToast, Button, Tab, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { clearHistory, removeHistory } from "@/actions/library";
import ResumeCard from "@/components/sections/Home/ResumeCard";
import TitleGrid from "@/components/sections/Title/TitleGrid";
import type { HistoryDTO, TitleCardDTO } from "@/types/dto";

const LibraryView: React.FC<{ watchlist: TitleCardDTO[]; histories: HistoryDTO[] }> = ({ watchlist, histories }) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useQueryState("tab", parseAsStringLiteral(["watchlist", "history"]).withDefault("watchlist"));

  const run = (action: () => Promise<{ success: boolean; message?: string }>) =>
    startTransition(async () => {
      const result = await action();
      addToast({ title: result.message, color: result.success ? "success" : "danger" });
      router.refresh();
    });

  return (
    <Tabs
      size="lg"
      variant="underlined"
      selectedKey={tab}
      onSelectionChange={(key) => setTab(key as "watchlist" | "history")}
      classNames={{ panel: "pt-4" }}
    >
      <Tab key="watchlist" title={`Danh sách của tôi (${watchlist.length})`}>
        <TitleGrid titles={watchlist} empty="Bạn chưa lưu phim nào. Bấm biểu tượng 🔖 ở trang phim để lưu." />
      </Tab>
      <Tab key="history" title={`Lịch sử xem (${histories.length})`}>
        {histories.length > 0 && (
          <div className="mb-4 flex justify-end">
            <Button
              color="danger"
              variant="flat"
              size="sm"
              isLoading={pending}
              startContent={<Icon icon="mdi:delete-sweep" fontSize={18} />}
              onPress={() => confirm("Xoá toàn bộ lịch sử xem?") && run(clearHistory)}
            >
              Xoá toàn bộ
            </Button>
          </div>
        )}
        {histories.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {histories.map((item) => (
              <ResumeCard
                key={item.id}
                item={item}
                action={
                  <Button
                    isIconOnly
                    size="sm"
                    radius="full"
                    variant="flat"
                    className="bg-black/50 text-white"
                    aria-label="Xoá khỏi lịch sử"
                    onPress={() => run(() => removeHistory(item.id))}
                  >
                    <Icon icon="mdi:close" fontSize={16} />
                  </Button>
                }
              />
            ))}
          </div>
        ) : (
          <p className="text-foreground-500 py-12 text-center">Chưa có lịch sử xem.</p>
        )}
      </Tab>
    </Tabs>
  );
};

export default LibraryView;
