"use client";

import "@videojs/react/video/skin.css";
import "@videojs/react/i18n/locales/vi/register";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { I18nProvider } from "@videojs/react/i18n";
import { VideoPlayer, VideoSkin, usePlayer } from "@videojs/react/video";
import { HlsJsVideo } from "@videojs/react/media/hlsjs-video";
import { Button, Progress } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useDocumentTitle } from "@mantine/hooks";
import Episodes from "@/components/sections/Title/Episodes";
import { useSite } from "@/components/providers/SiteProvider";
import type { PlaybackDTO } from "@/types/dto";
import { cn } from "@/utils/helpers";

type ProgressEvent = "start" | "progress" | "ended";

const ACCENT = { movie: "#006FEE", tv: "#F5A524" };

const useProgressReporter = (playback: PlaybackDTO) =>
  useCallback(
    (event: ProgressEvent, position: number, duration: number, beacon = false) => {
      const body = JSON.stringify({
        titleId: playback.titleId,
        episodeId: playback.episodeId,
        position,
        duration,
        event,
      });
      if (beacon && navigator.sendBeacon) {
        navigator.sendBeacon("/api/player/progress", body);
        return;
      }
      void fetch("/api/player/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => undefined);
    },
    [playback.titleId, playback.episodeId],
  );

/** Lưu tiến độ mỗi 10 giây, khi tạm dừng và khi rời trang; tính 1 lượt xem sau 10 giây phát. */
const ProgressSaver: React.FC<{ report: ReturnType<typeof useProgressReporter> }> = ({ report }) => {
  const store = usePlayer();
  const bucket = usePlayer((s) => Math.floor(s.currentTime / 10));
  const paused = usePlayer((s) => s.paused);
  const counted = useRef(false);

  useEffect(() => {
    const { currentTime, duration } = store.state;
    if (!(duration > 0) || currentTime < 1) return;
    if (!counted.current && currentTime >= 10) {
      counted.current = true;
      report("start", currentTime, duration);
      return;
    }
    report("progress", currentTime, duration);
  }, [bucket, paused, store, report]);

  useEffect(() => {
    const flush = () => {
      const { currentTime, duration } = store.state;
      if (duration > 0 && currentTime > 1) report("progress", currentTime, duration, true);
    };
    const onVisibility = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [store, report]);

  return null;
};

/** Thanh tiêu đề phía trên, ẩn/hiện cùng thanh điều khiển của player. */
const PlayerHeader: React.FC<{ playback: PlaybackDTO; onToggleEpisodes?: () => void }> = ({ playback, onToggleEpisodes }) => {
  const visible = usePlayer((s) => s.controlsVisible || s.paused);
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 z-[35] flex items-start gap-3 bg-linear-to-b from-black/80 to-transparent p-3 pb-12 text-white transition-opacity duration-300 md:p-5",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <Button
        as={Link}
        href={playback.detailHref}
        isIconOnly
        variant="light"
        className="pointer-events-auto text-white"
        aria-label="Quay lại"
      >
        <Icon icon="line-md:chevron-left" fontSize={32} />
      </Button>
      <div className="min-w-0 flex-1 pt-1">
        <h1 className="truncate text-lg font-bold md:text-2xl">{playback.title}</h1>
        {playback.subtitle && <p className="truncate text-sm text-white/80 md:text-base">{playback.subtitle}</p>}
      </div>
      {onToggleEpisodes && (
        <Button
          variant="flat"
          className="pointer-events-auto bg-white/15 text-white backdrop-blur-md"
          startContent={<Icon icon="mdi:format-list-numbered" fontSize={20} />}
          onPress={onToggleEpisodes}
        >
          <span className="hidden sm:inline">Danh sách tập</span>
        </Button>
      )}
    </div>
  );
};

/** Nút tập tiếp theo + đếm ngược tự chuyển khi xem hết. */
const NextEpisode: React.FC<{ next: PlaybackDTO["next"]; ended: boolean; onCancel: () => void }> = ({ next, ended, onCancel }) => {
  const router = useRouter();
  const visible = usePlayer((s) => s.controlsVisible || (s.duration > 0 && s.duration - s.currentTime < 45));
  const [countdown, setCountdown] = useState(10);
  // Reset đếm ngược mỗi lần xem hết (điều chỉnh state ngay khi render thay vì trong effect)
  const [wasEnded, setWasEnded] = useState(ended);
  if (wasEnded !== ended) {
    setWasEnded(ended);
    if (ended) setCountdown(10);
  }

  useEffect(() => {
    if (!ended || !next) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [ended, next]);

  useEffect(() => {
    if (ended && next && countdown <= 0) router.push(next.href);
  }, [countdown, ended, next, router]);

  if (!next) return null;

  if (ended) {
    return (
      <div className="absolute inset-0 z-[36] flex items-center justify-center bg-black/70 p-4 text-white">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <p className="text-white/70">Tập tiếp theo sau {Math.max(0, countdown)} giây</p>
          <p className="text-xl font-bold">{next.label}</p>
          <Progress aria-label="Đếm ngược" value={((10 - countdown) / 10) * 100} color="warning" size="sm" />
          <div className="flex gap-3">
            <Button color="warning" variant="shadow" onPress={() => router.push(next.href)}>
              Xem ngay
            </Button>
            <Button variant="flat" className="text-white" onPress={onCancel}>
              Huỷ
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Button
      as={Link}
      href={next.href}
      color="warning"
      variant="shadow"
      endContent={<Icon icon="mdi:skip-next" fontSize={22} />}
      className={cn(
        "absolute right-4 bottom-28 z-[35] transition-opacity md:right-8",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      Tập tiếp theo
    </Button>
  );
};

const PlayerShell: React.FC<{ playback: PlaybackDTO; children: React.ReactNode }> = ({ playback, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black text-white">
    {playback.poster && (
      <img src={playback.poster} alt="" className="absolute inset-0 size-full object-cover opacity-30 blur-sm" />
    )}
    <Button
      as={Link}
      href={playback.detailHref}
      isIconOnly
      variant="light"
      className="absolute top-4 left-4 z-10 text-white"
      aria-label="Quay lại"
    >
      <Icon icon="line-md:chevron-left" fontSize={32} />
    </Button>
    <div className="relative z-10 flex max-w-md flex-col items-center gap-4 p-6 text-center">{children}</div>
  </div>
);

/** Trạng thái chưa phát được: đang xử lý / lỗi / chưa có video. Tự làm mới khi đang xử lý. */
const NotReady: React.FC<{ playback: PlaybackDTO }> = ({ playback }) => {
  const router = useRouter();
  useEffect(() => {
    if (playback.status !== "processing") return;
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [playback.status, router]);

  return (
    <PlayerShell playback={playback}>
      <h2 className="text-2xl font-bold">{playback.title}</h2>
      {playback.subtitle && <p className="text-white/70">{playback.subtitle}</p>}
      {playback.status === "processing" && (
        <>
          <Icon icon="line-md:loading-twotone-loop" fontSize={48} className="text-warning" />
          <p>Video đang được xử lý, vui lòng chờ trong giây lát...</p>
          <Progress aria-label="Tiến độ xử lý" value={playback.progress} color="warning" showValueLabel className="w-64" />
        </>
      )}
      {playback.status === "failed" && <p className="text-danger">Video bị lỗi khi xử lý. Vui lòng báo quản trị viên.</p>}
      {playback.status === "missing" && <p>Phim chưa có video. Vui lòng quay lại sau.</p>}
    </PlayerShell>
  );
};

const Player: React.FC<{ playback: PlaybackDTO }> = ({ playback }) => {
  const { settings } = useSite();
  const report = useProgressReporter(playback);
  const [ended, setEnded] = useState(false);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const tv = playback.type === "tv";

  useDocumentTitle(`${playback.title}${playback.subtitle && tv ? ` - ${playback.subtitle}` : ""} | ${settings.siteName}`);

  if (playback.status !== "ready" || !playback.src) return <NotReady playback={playback} />;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <I18nProvider locale="vi">
        <VideoPlayer poster={playback.poster ?? undefined}>
          <VideoSkin
            className="h-dvh w-full"
            style={{ "--media-accent-color": ACCENT[playback.type], "--media-accent-text-color": "#000", "--media-border-radius": "0" } as CSSProperties}
          >
            <HlsJsVideo
              key={playback.src}
              src={playback.src}
              playsInline
              autoPlay
              fallback={null}
              onLoadedMetadata={(e) => {
                const t = playback.startAt;
                if (t > 5 && t < e.currentTarget.duration - 10) e.currentTarget.currentTime = t;
              }}
              onPlay={() => setEnded(false)}
              onEnded={(e) => {
                report("ended", e.currentTarget.duration, e.currentTarget.duration);
                setEnded(true);
              }}
            >
              {playback.tracks.map((track) => (
                <track key={track.src} kind="subtitles" src={track.src} srcLang={track.lang} label={track.label} default={track.isDefault} />
              ))}
              {playback.storyboard && <track kind="metadata" label="thumbnails" src={playback.storyboard} default />}
            </HlsJsVideo>

            <PlayerHeader playback={playback} onToggleEpisodes={tv ? () => setShowEpisodes((v) => !v) : undefined} />
            <NextEpisode next={playback.next} ended={ended} onCancel={() => setEnded(false)} />

            {tv && (
              <aside
                className={cn(
                  "bg-background/95 absolute inset-y-0 right-0 z-[40] w-full max-w-md overflow-y-auto p-4 text-left backdrop-blur-md transition-transform duration-300",
                  showEpisodes ? "translate-x-0" : "pointer-events-none translate-x-full",
                )}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-bold">Danh sách tập</h3>
                  <Button isIconOnly variant="light" onPress={() => setShowEpisodes(false)} aria-label="Đóng">
                    <Icon icon="mdi:close" fontSize={22} />
                  </Button>
                </div>
                <Episodes
                  compact
                  slug={playback.slug}
                  seasons={playback.seasons}
                  current={{ season: playback.currentSeason ?? 1, episode: playback.currentEpisode ?? 1 }}
                  onNavigate={() => setShowEpisodes(false)}
                />
              </aside>
            )}
          </VideoSkin>
          <ProgressSaver report={report} />
        </VideoPlayer>
      </I18nProvider>
    </div>
  );
};

export default Player;
