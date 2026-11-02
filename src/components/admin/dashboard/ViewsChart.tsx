"use client";

import { useState } from "react";
import { cn } from "@/utils/helpers";

type Day = { date: string; label: string; count: number };

/** Làm tròn mốc trục Y lên số "đẹp" (1, 2, 5, 10, 20, 50...). */
const niceMax = (value: number) => {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((s) => s * magnitude >= value)! * magnitude;
  return step;
};

/**
 * Biểu đồ cột lượt xem theo ngày — một chuỗi dữ liệu nên không cần chú thích (tiêu đề đã gọi tên).
 * Cột ≤ 24px, bo 4px ở đầu dữ liệu, vuông ở đường đáy; di chuột để xem số liệu từng ngày.
 */
const ViewsChart: React.FC<{ days: Day[] }> = ({ days }) => {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...days.map((d) => d.count), 0));
  const peak = days.reduce((best, d, i) => (d.count > days[best].count ? i : best), 0);
  const ticks = [max, max / 2, 0];

  return (
    <div className="relative">
      <div className="flex gap-2">
        {/* Trục Y */}
        <div className="text-foreground-500 flex h-48 flex-col justify-between py-0 text-right text-[11px] tabular-nums">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {Math.round(t).toLocaleString("vi-VN")}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          {/* Lưới nền nhạt */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-48">
            {ticks.map((t, i) => (
              <div
                key={t}
                className={cn("border-divider absolute inset-x-0 border-t", i === ticks.length - 1 && "border-foreground-300")}
                style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
              />
            ))}
          </div>
          {/* Cột */}
          <div className="relative flex h-48 items-end gap-[2px]" role="img" aria-label="Biểu đồ lượt xem 14 ngày gần nhất">
            {days.map((d, i) => (
              <div
                key={d.date}
                className="relative flex h-full flex-1 cursor-default items-end justify-center"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {i === peak && d.count > 0 && hover === null && (
                  <span
                    className="text-foreground-600 absolute text-[11px] font-semibold tabular-nums"
                    style={{ bottom: `calc(${(d.count / max) * 100}% + 4px)` }}
                  >
                    {d.count}
                  </span>
                )}
                <div
                  className={cn(
                    "w-full max-w-6 rounded-t-[4px] bg-[#006FEE] transition-opacity dark:bg-[#338EF7]",
                    hover !== null && hover !== i && "opacity-40",
                  )}
                  style={{ height: d.count ? `max(${(d.count / max) * 100}%, 2px)` : 0 }}
                />
                {hover === i && (
                  <div className="bg-content1 border-divider pointer-events-none absolute bottom-full z-10 mb-1 rounded-lg border px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg">
                    <p className="text-foreground-500">{new Date(d.date).toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" })}</p>
                    <p className="text-foreground font-semibold tabular-nums">{d.count.toLocaleString("vi-VN")} lượt xem</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Trục X */}
          <div className="text-foreground-500 mt-1.5 flex gap-[2px] text-[11px]">
            {days.map((d, i) => (
              <span key={d.date} className="flex-1 text-center">
                {i % 2 === 0 || i === days.length - 1 ? d.label : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
      {/* Bảng dữ liệu cho trình đọc màn hình */}
      <table className="sr-only">
        <caption>Lượt xem theo ngày</caption>
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Lượt xem</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <td>{d.label}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ViewsChart;
