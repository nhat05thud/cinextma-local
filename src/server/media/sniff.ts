/* eslint-disable @typescript-eslint/no-explicit-any -- dữ liệu thô từ Chrome DevTools Protocol */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { killTree } from "./ffmpeg";

/*
 * Tự dò link video giống cách các công cụ tải video Twitter/X làm: trình phát chỉ hiện blob:, nhưng link thật
 * (.m3u8 / .mpd / .mp4) vẫn đi qua mạng hoặc nằm sẵn trong dữ liệu API / trang nhúng.
 *
 * Mở trang bằng Chrome/Edge chạy ẩn (headless), cuộn hết trang (lazyload), sang trang "Xem phim" nếu đang ở
 * trang thông tin phim, bấm phát, rồi bắt link từ:
 *   1. request mạng (.m3u8 / .mpd / .mp4 hoặc content-type tương ứng),
 *   2. phản hồi có nội dung bắt đầu bằng #EXTM3U (playlist đổi đuôi .png/.txt để giấu),
 *   3. link video nằm trong JSON của API, HTML của iframe trình phát hoặc tham số ?url= của iframe.
 *
 * Tránh bị phát hiện: không bật Runtime/Debugger/Console của DevTools (thư viện chống F12 như disable-devtool
 * dựa vào chúng), chạy script trong "isolated world" tách khỏi script của trang, ẩn navigator.webdriver,
 * User-Agent khớp phiên bản trình duyệt thật.
 * An toàn: giữ sandbox (không dùng --no-sandbox), profile tạm xoá sau mỗi lần, chặn tải file, đóng tab quảng cáo,
 * chặn quảng cáo chuyển hướng tab chính, chỉ chạy một phiên một lúc.
 */

export type SniffedMedia = {
  url: string;
  /** Trang/iframe đã yêu cầu link này — gửi kèm làm Referer khi tải */
  referer: string | null;
  kind: "hls" | "dash" | "mp4";
  /** Playlist HLS tổng (có nhiều mức chất lượng) */
  master: boolean;
  size: number;
  /** Chỉ thấy trong nội dung trang/API, chưa thấy trình phát tải */
  fromBody: boolean;
};

export type SniffResult = {
  media: SniffedMedia[];
  title: string | null;
  /** Địa chỉ trang lúc kết thúc (khác link gốc nếu đã sang trang "Xem phim") */
  finalUrl: string;
  frames: number;
  /** Thẻ của các khung trình phát tìm được, từ trên xuống (video / iframe / div...) */
  players: string[];
  /** Trang dừng ở màn hình kiểm tra chống bot (Cloudflare...) */
  challenge: boolean;
  /** Ảnh chụp màn hình khi không dò được, để xem trình duyệt ẩn thấy gì */
  screenshot: string | null;
};

const AD_HOSTS = /(doubleclick|googlesyndication|googleadservices|imasdk|adservice|adsystem|adnxs|popads|propeller|exoclick|juicyads|adserver|\bads?\.|vast|vmap)/i;
/** Video YouTube (trailer nhúng) không tải trực tiếp được — dán thẳng link YouTube thay vào */
const SKIP_HOSTS = /(googlevideo\.com|youtube\.com|youtube-nocookie\.com|ytimg\.com)/i;
const NOT_MEDIA = /\.(ts|m4s|m4a|aac|vtt|srt|key|jpe?g|png|webp|gif|svg|js|css|woff2?|json)(\?|$)/i;
/** Link video nằm trong văn bản (JSON/HTML/JS), đã bỏ escape "\/" */
const MEDIA_IN_TEXT = /https?:\/\/[^\s"'<>()\\]+?\.(?:m3u8|mpd|mp4)(?:\?[^\s"'<>()\\]*)?(?=[\s"'<>()\\,;&#]|$)/gi;
/** Màn hình kiểm tra chống bot (Cloudflare / DDoS-Guard), kể cả bản tiếng Việt */
const CHALLENGE = /just a moment|checking your browser|attention required|verify you are human|chờ một chút|xác minh bảo mật|đang kiểm tra|ddos-guard/i;
const TOTAL_TIMEOUT_MS = 90_000;
const VIEWPORT = { width: 1280, height: 720 };
/** mp4 nhỏ hơn mức này thường là video nền/quảng cáo -> vẫn tiếp tục tìm trình phát chính */
const SMALL_MP4 = 8 * 1024 * 1024;
const MAX_BODY_READS = 200;
/** Số khung trình phát tối đa bấm thử trên một trang */
const MAX_PLAYERS = 15;
const MAX_RESULTS = 30;

const BROWSER_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
];

export const findBrowser = () => BROWSER_CANDIDATES.find((p) => p && fs.existsSync(p)) ?? null;

/**
 * User-Agent giống trình duyệt thường, đúng phiên bản đang cài (lệch phiên bản với Client Hints là dấu hiệu bot).
 * Windows: đọc thư mục phiên bản cạnh chrome.exe/msedge.exe; Linux: chạy --version.
 */
const userAgentFor = (browserPath: string) => {
  let major = "";
  try {
    major = fs
      .readdirSync(path.dirname(browserPath))
      .filter((name) => /^\d+\.\d+\.\d+\.\d+$/.test(name))
      .map((name) => name.split(".")[0])
      .sort((a, b) => Number(b) - Number(a))[0] ?? "";
  } catch {
    // bỏ qua
  }
  if (!major && process.platform !== "win32") {
    const out = spawnSync(browserPath, ["--version"], { encoding: "utf8", timeout: 10_000 });
    major = /(\d+)\.\d+\.\d+/.exec(out.stdout ?? "")?.[1] ?? "";
  }
  major ||= "140";
  const platform = process.platform === "win32" ? "Windows NT 10.0; Win64; x64" : "X11; Linux x86_64";
  const edge = /msedge/i.test(path.basename(browserPath)) ? ` Edg/${major}.0.0.0` : "";
  return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36${edge}`;
};

/** Thử bấm phát trong một frame: video.play() + các nút play phổ biến của JW Player, Video.js, Plyr, ArtPlayer... */
const PLAY_SCRIPT = `(() => {
  let n = 0;
  for (const v of document.querySelectorAll("video")) { try { v.muted = true; const p = v.play(); if (p) p.catch(() => {}); n++; } catch {} }
  const selectors = [".vjs-big-play-button", ".jw-icon-display", ".jw-display-icon-container", ".plyr__control--overlaid",
    ".fp-play", ".art-control-play", ".art-state-play", ".dplayer-mobile-play", ".mejs__overlay-button", ".play-button",
    ".btn-play", ".play-btn", "[class*='play-button']", "[class*='playBtn']", "button[aria-label*='play' i]", "[title*='play' i]"];
  for (const s of selectors) for (const el of document.querySelectorAll(s)) { try { el.click(); n++; } catch {} }
  return n;
})()`;

/**
 * Phần tử đang cuộn của trang: thường là cả trang, nhưng trang kiểu "app" (body không cuộn, nội dung nằm trong
 * một khung overflow:auto) thì chọn khung cuộn lớn nhất.
 */
const SCROLLER = `(() => {
  const doc = document.scrollingElement || document.documentElement;
  if (doc.scrollHeight > innerHeight + 50) return doc;
  let el = doc, best = 0;
  for (const e of document.querySelectorAll("body *")) {
    if (e.scrollHeight <= e.clientHeight + 50 || e.clientHeight < innerHeight / 3) continue;
    const overflow = getComputedStyle(e).overflowY;
    if (overflow !== "auto" && overflow !== "scroll" && overflow !== "overlay") continue;
    if (e.clientWidth * e.clientHeight > best) { el = e; best = e.clientWidth * e.clientHeight; }
  }
  return el;
})()`;
/** Vị trí cuộn: [đang ở, tổng chiều cao, chiều cao khung nhìn] */
const SCROLL_INFO = `(() => { const e = ${SCROLLER}; const doc = e === (document.scrollingElement || document.documentElement);
  return [Math.round(e.scrollTop), e.scrollHeight, doc ? innerHeight : e.clientHeight]; })()`;

/**
 * Đánh dấu MỌI khung trình phát trên trang (data-cx-player="0..n-1", từ trên xuống dưới) để bấm lần lượt.
 * Ưu tiên video / iframe / embed; khối có tên "player"/"embed" chỉ tính khi bên trong chưa có video/iframe;
 * khối tên "video" (hay là thẻ phim liên quan) chỉ dùng khi không còn gì khác. Bỏ iframe quảng cáo / trailer YouTube.
 */
const MARK_PLAYERS_SCRIPT = `(() => {
  for (const el of document.querySelectorAll("[data-cx-player]")) el.removeAttribute("data-cx-player");
  const AD_SIZES = [[300, 250], [336, 280], [250, 250], [320, 100]];
  const usable = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 200 || r.height < 112) return false;
    const ratio = r.height / r.width;
    if (ratio < 0.3 || ratio > 1.2) return false; // dải ngang / cột dọc / khối bao cả trang
    if (AD_SIZES.some(([w, h]) => Math.abs(r.width - w) <= 6 && Math.abs(r.height - h) <= 6)) return false; // kể cả viền
    const st = getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden" || Number(st.opacity) === 0) return false;
    const src = el.src || el.data || "";
    return !(${AD_HOSTS}.test(src) || ${SKIP_HOSTS}.test(src));
  };
  const pick = (sel) => [...document.querySelectorAll(sel)].filter(usable);
  const media = pick("video, iframe, embed, object");
  let players = [...media, ...pick("[id*='player' i], [class*='player' i], [id*='embed' i], [class*='embed' i]")
    .filter((el) => !media.some((m) => el.contains(m)))];
  if (!players.length) players = pick("[id*='video' i], [class*='video' i]");
  // Khung lồng nhau (div.player > div.player-inner) -> giữ phần tử trong cùng
  players = players.filter((el) => !players.some((o) => o !== el && el.contains(o)));
  players.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  players = players.slice(0, ${MAX_PLAYERS});
  players.forEach((el, i) => el.setAttribute("data-cx-player", String(i)));
  return players.map((el) => el.tagName.toLowerCase());
})()`;

/** Cuộn khung trình phát thứ i vào giữa màn hình. */
const SHOW_PLAYER = (i: number) =>
  `(() => { const el = document.querySelector('[data-cx-player="${i}"]'); if (el) el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" }); return !!el; })()`;

/** Toạ độ tâm khung trình phát thứ i (đo lại sau khi cuộn xong). */
const PLAYER_CENTER = (i: number) => `(() => {
  const el = document.querySelector('[data-cx-player="${i}"]'); if (!el) return null;
  const r = el.getBoundingClientRect();
  const clamp = (v, max) => Math.max(10, Math.min(max - 10, v));
  return [clamp(r.left + r.width / 2, innerWidth), clamp(r.top + r.height / 2, innerHeight)];
})()`;

/** Tải lại các iframe bị lỗi (gán lại src). */
const RELOAD_FRAMES = (urls: string[]) => `(() => {
  const failed = new Set(${JSON.stringify(urls)});
  let n = 0;
  for (const f of document.querySelectorAll("iframe")) if (failed.has(f.src)) { f.src = f.src; n++; }
  return n;
})()`;

/** Trang thông tin phim: tìm nút "Xem phim" / "Tập 1" nổi bật nhất để sang trang có trình phát. */
const WATCH_LINK_SCRIPT = `(() => {
  const re = /^[\\s▶►▷»]*(xem phim|xem ngay|xem online|xem full|xem tập|watch( now| online| movie)?|play( now)?|tập\\s*0*1|ep(isode)?\\s*0*1)\\b/i;
  const here = location.href.split("#")[0];
  let best = null, bestArea = 0;
  for (const a of document.querySelectorAll("a[href]")) {
    const text = (a.innerText || a.title || a.getAttribute("aria-label") || "").trim().slice(0, 60);
    if (!re.test(text) || !/^https?:/.test(a.href) || a.href.split("#")[0] === here) continue;
    const r = a.getBoundingClientRect();
    if (r.width * r.height > bestArea) { best = a.href; bestArea = r.width * r.height; }
  }
  return best;
})()`;

/** Tên miền chính (bỏ subdomain), đủ để phân biệt trang phim với trang quảng cáo. */
const siteOf = (url: string) => {
  try {
    const parts = new URL(url).hostname.split(".");
    return parts.slice(parts.length > 2 && parts[parts.length - 2].length <= 3 ? -3 : -2).join(".");
  } catch {
    return url;
  }
};

/** Link các playlist con trong playlist tổng (#EXT-X-STREAM-INF / #EXT-X-MEDIA URI="..."). */
const playlistUris = (text: string, base: string) =>
  text.split(/\r?\n/).flatMap((line) => {
    const t = line.trim();
    const uri = t.startsWith("#") ? /URI="([^"]+)"/.exec(t)?.[1] : t;
    if (!uri) return [];
    try {
      return [new URL(uri, base).href];
    } catch {
      return [];
    }
  });

/**
 * Khoá so trùng: bỏ các tham số kiểu token / chữ ký / thời hạn (đổi mỗi lần bấm phát) nhưng giữ tham số
 * phân biệt video (?id=1 khác ?id=2).
 */
const dedupeKey = (url: string) => {
  try {
    const u = new URL(url);
    const kept = [...u.searchParams]
      .filter(([name]) => !/^(token|sig|signature|expires?|exp|st|e|t|ts|time|hash|auth|hdnts|policy|key-pair-id|_)$/i.test(name))
      .filter(([, value]) => !/^\d{10,13}$/.test(value) && !/^[\w-]{24,}$/.test(value))
      .sort(([a], [b]) => a.localeCompare(b));
    return `${u.origin}${u.pathname}?${new URLSearchParams(kept)}`;
  } catch {
    return url;
  }
};

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

type Pending = { resolve: (value: Record<string, unknown>) => void; reject: (error: Error) => void };
type CdpEvent = { method: string; params: Record<string, any>; sessionId?: string };
type RequestInfo = { url: string; referer: string | null; kind: SniffedMedia["kind"] | null; type: string; mime: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Cổng DevTools: trình duyệt ghi ra file DevToolsActivePort khi dùng --remote-debugging-port=0. */
const waitForPort = async (profile: string, exited: () => boolean) => {
  const file = path.join(profile, "DevToolsActivePort");
  for (let i = 0; i < 100; i++) {
    if (exited()) throw new Error("Trình duyệt ẩn thoát ngay khi khởi động");
    const text = await fs.promises.readFile(file, "utf8").catch(() => "");
    const port = Number(text.split(/\r?\n/)[0]);
    if (port > 0) return port;
    await sleep(150);
  }
  throw new Error("Không khởi động được trình duyệt ẩn");
};

// Chạy lần lượt: mỗi phiên dò tốn ~200-400MB RAM
let queue: Promise<unknown> = Promise.resolve();
export function sniffMedia(pageUrl: string) {
  const job = queue.then(() => sniff(pageUrl));
  queue = job.catch(() => undefined);
  return job;
}

async function sniff(pageUrl: string): Promise<SniffResult> {
  const browserPath = findBrowser();
  if (!browserPath) throw new Error("Không tìm thấy Chrome/Edge trên máy chủ để tự dò video (đặt CHROME_PATH trong .env).");

  const profile = await fs.promises.mkdtemp(path.join(os.tmpdir(), "cinextma-sniff-"));
  const proc = spawn(
    browserPath,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--mute-audio",
      "--autoplay-policy=no-user-gesture-required",
      // navigator.webdriver = false như trình duyệt thường
      "--disable-blink-features=AutomationControlled",
      // iframe khác domain chạy chung tiến trình -> thấy được request của trình phát nhúng
      "--disable-site-isolation-trials",
      "--disable-features=IsolateOrigins,site-per-process,Translate",
      "--disable-smooth-scrolling",
      "--accept-lang=vi-VN,vi,en-US,en",
      `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
      `--user-agent=${userAgentFor(browserPath)}`,
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  );
  let exited = false;
  proc.on("exit", () => (exited = true));
  let ws: WebSocket | null = null;
  const started = Date.now();

  try {
    const port = await waitForPort(profile, () => exited);
    const version = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()) as { webSocketDebuggerUrl: string };
    ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => {
      ws!.addEventListener("open", () => resolve(), { once: true });
      ws!.addEventListener("error", () => reject(new Error("Không kết nối được trình duyệt ẩn")), { once: true });
    });

    // --- Client CDP tối giản (chế độ flatten: mọi target dùng chung một kết nối, phân biệt bằng sessionId)
    let nextId = 0;
    const pending = new Map<number, Pending>();
    const listeners: ((event: CdpEvent) => void)[] = [];
    ws.addEventListener("message", (message) => {
      const data = JSON.parse(String(message.data));
      if (data.id !== undefined) {
        const p = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) p?.reject(new Error(data.error.message));
        else p?.resolve(data.result ?? {});
      } else if (data.method) {
        listeners.forEach((l) => l(data as CdpEvent));
      }
    });
    const send = (method: string, params: Record<string, unknown> = {}, sessionId?: string) =>
      new Promise<Record<string, any>>((resolve, reject) => {
        const id = ++nextId;
        pending.set(id, { resolve, reject });
        ws!.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    const quiet = (p: Promise<unknown>) => p.catch(() => undefined);

    const found = new Map<string, SniffedMedia>();
    const requests = new Map<string, RequestInfo>();
    const frames = new Map<string, string>(); // frameId -> sessionId của target chứa frame đó
    const worlds = new Map<string, number>(); // `${sessionId}|${frameId}` -> executionContextId của isolated world
    /** Playlist con (từng mức chất lượng / audio) của các playlist tổng đã đọc — không tính là video riêng */
    const variants = new Set<string>();
    let bodyReads = 0;
    let pendingBodies = 0;
    /** iframe trình phát tải lỗi (máy chủ video ngắt kết nối...) -> lượt sau tải lại */
    const failedFrames = new Set<string>();

    const classify = (url: string, mime = ""): SniffedMedia["kind"] | null => {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return null;
      }
      if (!/^https?:$/.test(parsed.protocol)) return null;
      if (AD_HOSTS.test(parsed.hostname + parsed.pathname) || SKIP_HOSTS.test(parsed.hostname)) return null;
      // Xét đuôi của đường dẫn, không xét query: /player?url=...index.m3u8 là trang nhúng chứ không phải playlist
      const file = parsed.pathname;
      if (/mpegurl/i.test(mime) || /\.m3u8$/i.test(file)) return "hls";
      if (/dash\+xml/i.test(mime) || /\.mpd$/i.test(file)) return "dash";
      if (NOT_MEDIA.test(file)) return null;
      if (/^video\/(mp4|webm)/i.test(mime) || /\.(mp4|webm)$/i.test(file)) return "mp4";
      return null;
    };
    const remember = (url: string, referer: string | null, kind: SniffedMedia["kind"], fromBody = false) => {
      const item = found.get(url);
      if (item) {
        if (!fromBody) item.fromBody = false; // trình phát đã thực sự tải link này
      } else if (found.size < 150) {
        found.set(url, { url, referer, kind, master: false, size: 0, fromBody });
      }
    };
    /** Link video lộ trong JSON / HTML / JS (kiểu API của Twitter trả sẵn link .m3u8). */
    const scanText = (text: string, referer: string | null) => {
      const clean = text.replace(/\\u002[fF]/g, "/").replace(/\\\//g, "/");
      for (const match of clean.matchAll(MEDIA_IN_TEXT)) {
        const url = match[0].replace(/&amp;/g, "&");
        const kind = classify(url);
        if (kind) remember(url, referer, kind, true);
      }
    };

    let mainTargetId = "";
    let mainSession = "";
    let loaded = false;
    // Sau khi bắt đầu thao tác, chặn mọi điều hướng tab chính (quảng cáo, bấm nhầm thẻ phim liên quan...)
    // trừ khi chính bộ dò mở trang "Xem phim"
    let homeUrl = pageUrl;
    let locked = false;
    let allowNavTo: string | null = null;

    listeners.push((event) => {
      const { method, params } = event;
      const sessionId = event.sessionId ?? "";
      const key = `${sessionId}:${params.requestId}`;
      switch (method) {
        case "Target.targetCreated":
          // Tab quảng cáo bật lên -> đóng ngay
          if (params.targetInfo.type === "page" && mainTargetId && params.targetInfo.targetId !== mainTargetId) {
            void quiet(send("Target.closeTarget", { targetId: params.targetInfo.targetId }));
          }
          break;
        case "Target.attachedToTarget": {
          // iframe chạy tiến trình riêng / worker: bật theo dõi mạng rồi cho chạy tiếp
          const child = params.sessionId as string;
          if (params.targetInfo.type === "iframe") frames.set(params.targetInfo.targetId, child);
          void Promise.all([
            quiet(send("Network.enable", {}, child)),
            quiet(send("Page.enable", {}, child)),
            quiet(send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, child)),
          ]).finally(() => void quiet(send("Runtime.runIfWaitingForDebugger", {}, child)));
          break;
        }
        case "Page.frameNavigated":
          frames.set(params.frame.id, sessionId);
          worlds.delete(`${sessionId}|${params.frame.id}`);
          if (sessionId === mainSession && !params.frame.parentId) homeUrl = params.frame.url;
          break;
        case "Page.frameDetached":
          if (frames.get(params.frameId) === sessionId) frames.delete(params.frameId);
          break;
        case "Page.loadEventFired":
          if (sessionId === mainSession) loaded = true;
          break;
        case "Page.javascriptDialogOpening":
          void quiet(send("Page.handleJavaScriptDialog", { accept: true }, sessionId));
          break;
        case "Fetch.requestPaused": {
          const block =
            locked && params.frameId === mainTargetId && params.request.url !== allowNavTo && params.request.url !== homeUrl;
          // "Aborted" huỷ điều hướng mà không hiện trang lỗi -> trang phim vẫn nguyên
          void quiet(
            send(
              block ? "Fetch.failRequest" : "Fetch.continueRequest",
              block ? { requestId: params.requestId, errorReason: "Aborted" } : { requestId: params.requestId },
              sessionId,
            ),
          );
          break;
        }
        case "Network.requestWillBeSent": {
          const url = params.request.url as string;
          const referer = (params.request.headers?.Referer ?? params.request.headers?.referer ?? params.documentURL ?? null) as string | null;
          const isDocument = params.type === "Document";
          const kind = isDocument ? null : classify(url);
          requests.set(key, { url, referer, kind, type: params.type ?? "", mime: "" });
          if (kind) remember(url, referer, kind);
          // iframe trình phát kiểu /player?url=https://.../index.m3u8
          if (isDocument && url.includes("?")) scanText(safeDecode(url.slice(url.indexOf("?"))), url);
          break;
        }
        case "Network.responseReceived": {
          const request = requests.get(key);
          if (request) request.mime = params.response.mimeType ?? "";
          const kind = classify(params.response.url, params.response.mimeType);
          if (!kind) break;
          remember(params.response.url, request?.referer ?? null, kind);
          if (request) request.kind = kind;
          const headers = params.response.headers ?? {};
          const range = /\/(\d+)$/.exec(headers["content-range"] ?? headers["Content-Range"] ?? "");
          const size = Number(range?.[1] ?? headers["content-length"] ?? headers["Content-Length"] ?? 0);
          const item = found.get(params.response.url);
          if (item && size > item.size) item.size = size;
          break;
        }
        case "Network.loadingFailed": {
          const request = requests.get(key);
          if (request?.type === "Document" && request.url !== homeUrl && !params.canceled) failedFrames.add(request.url);
          break;
        }
        case "Network.loadingFinished": {
          const request = requests.get(key);
          if (!request) break;
          // Đọc nội dung: playlist thật? playlist tổng? hay JSON/HTML có chứa link video?
          const inspect =
            request.kind === "hls" ||
            (!request.kind &&
              ["XHR", "Fetch", "Document"].includes(request.type) &&
              !/^(video|audio|font)\//i.test(request.mime) &&
              params.encodedDataLength < 3_000_000 &&
              bodyReads++ < MAX_BODY_READS);
          if (!inspect) break;
          pendingBodies++;
          void send("Network.getResponseBody", { requestId: params.requestId }, sessionId || undefined)
            .then((body) => {
              const raw = body.base64Encoded ? Buffer.from(String(body.body), "base64") : Buffer.from(String(body.body ?? ""));
              const head = raw.subarray(0, 64).toString("utf8").replace(/^\uFEFF/, "").trimStart();
              if (head.startsWith("#EXTM3U")) {
                remember(request.url, request.referer, "hls");
                const item = found.get(request.url);
                const text = raw.toString("utf8");
                if (item && text.includes("#EXT-X-STREAM-INF")) {
                  item.master = true;
                  for (const variant of playlistUris(text, request.url)) variants.add(dedupeKey(variant));
                }
              } else if (request.kind === "hls") {
                found.delete(request.url); // đuôi .m3u8 nhưng là trang lỗi
              } else if (!body.base64Encoded) {
                scanText(raw.toString("utf8"), request.type === "Document" ? request.url : request.referer);
              }
            })
            .catch(() => undefined)
            .finally(() => pendingBodies--);
          break;
        }
      }
    });

    await send("Target.setDiscoverTargets", { discover: true });
    await quiet(send("Browser.setDownloadBehavior", { behavior: "deny" }));
    mainTargetId = (await send("Target.createTarget", { url: "about:blank" })).targetId;
    mainSession = (await send("Target.attachToTarget", { targetId: mainTargetId, flatten: true })).sessionId;
    // Không bật Runtime/Debugger/Log: trang chống F12 phát hiện được khi các domain này bật
    await Promise.all([
      send("Page.enable", {}, mainSession),
      send("Network.enable", {}, mainSession),
      send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: true, flatten: true }, mainSession),
      quiet(send("Fetch.enable", { patterns: [{ urlPattern: "*", resourceType: "Document", requestStage: "Request" }] }, mainSession)),
    ]);
    void quiet(send("Page.navigate", { url: pageUrl }, mainSession));

    let deadline = started + TOTAL_TIMEOUT_MS;
    const timeLeft = () => deadline - Date.now();
    const isVariant = (m: SniffedMedia) => !m.master && variants.has(dedupeKey(m.url));
    const isSmallMp4 = (m: SniffedMedia) => m.kind === "mp4" && m.size > 0 && m.size < SMALL_MP4;
    /** Số video "thật" trình phát đã tải (bỏ playlist con, mp4 nhỏ kiểu video nền/quảng cáo, link chỉ thấy trong dữ liệu) */
    const videoCount = () =>
      new Set([...found.values()].filter((m) => !m.fromBody && !isVariant(m) && !isSmallMp4(m)).map((m) => dedupeKey(m.url))).size;
    const waitForNew = async (before: number, ms: number) => {
      for (const end = Date.now() + ms; Date.now() < end && timeLeft() > 0 && videoCount() <= before; ) await sleep(200);
    };

    /** Chạy script trong isolated world của một frame: trang không thấy, không can thiệp được. */
    const evalIn = async (sessionId: string, frameId: string, expression: string): Promise<unknown> => {
      const worldKey = `${sessionId}|${frameId}`;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          let contextId = worlds.get(worldKey);
          if (!contextId) {
            // "grantUniveralAccess" — đúng chính tả của giao thức
            contextId = (await send("Page.createIsolatedWorld", { frameId, worldName: "cx", grantUniveralAccess: true }, sessionId))
              .executionContextId as number;
            worlds.set(worldKey, contextId);
          }
          const r = await send("Runtime.evaluate", { expression, contextId, returnByValue: true, userGesture: true }, sessionId);
          return r.exceptionDetails ? undefined : r.result?.value;
        } catch {
          worlds.delete(worldKey); // frame đã tải lại -> tạo world mới
        }
      }
      return undefined;
    };
    const evalMain = (expression: string) => evalIn(mainSession, mainTargetId, expression);
    const mouse = (type: string, x: number, y: number, extra: Record<string, unknown> = {}) =>
      quiet(send("Input.dispatchMouseEvent", { type, x, y, ...extra }, mainSession));

    /** Chờ trang tải xong (tối đa ~10 giây) và qua màn hình kiểm tra chống bot nếu có (tối đa ~20 giây). */
    const waitForPage = async () => {
      for (let i = 0; i < 50 && !loaded && timeLeft() > 0; i++) await sleep(200);
      await sleep(1500);
      for (let i = 0; i < 40 && timeLeft() > 0 && CHALLENGE.test(String((await evalMain("document.title")) ?? "")); i++) await sleep(500);
    };

    type ScrollInfo = [top: number, height: number, view: number] | undefined;
    const atBottom = (info: ScrollInfo) => !info || info[0] + info[2] >= info[1] - 4;
    /**
     * Cuộn từ đầu tới tận chân trang như người dùng: lăn chuột thật (kích hoạt cả các trang hoãn tải script
     * tới khi có tương tác), nếu trang không nhúc nhích (chuột nằm trên khung chặn lăn) thì cuộn bằng JS.
     * Chạm chân trang thì chờ thêm một chút: trang có thể nạp thêm nội dung / trình phát ở cuối.
     */
    const scrollThrough = async (maxSteps: number) => {
      await evalMain(`${SCROLLER}.scrollTo(0, 0)`);
      await mouse("mouseMoved", VIEWPORT.width / 2, VIEWPORT.height / 2);
      for (let step = 0; step < maxSteps && timeLeft() > 0; step++) {
        const before = (await evalMain(SCROLL_INFO)) as ScrollInfo;
        await mouse("mouseWheel", VIEWPORT.width / 2, VIEWPORT.height / 2, { deltaX: 0, deltaY: VIEWPORT.height * 0.8 });
        await sleep(400);
        let after = (await evalMain(SCROLL_INFO)) as ScrollInfo;
        if (before && after && after[0] === before[0]) {
          await evalMain(`${SCROLLER}.scrollBy(0, ${VIEWPORT.height * 0.8})`);
          await sleep(400);
          after = (await evalMain(SCROLL_INFO)) as ScrollInfo;
        }
        if (atBottom(after)) {
          await sleep(1000);
          const later = (await evalMain(SCROLL_INFO)) as ScrollInfo;
          if (atBottom(later) && later?.[1] === after?.[1]) break; // tới chân trang, không nạp thêm gì
        }
      }
    };

    /** Gọi play() + bấm nút play trong mọi frame (nhiều trình phát tự tải link ngay). */
    const playAll = () => Promise.all([...frames].map(([frameId, sessionId]) => evalIn(sessionId, frameId, PLAY_SCRIPT)));
    /** Cuộn khung trình phát thứ i vào giữa màn hình rồi nhấn chuột thật vào tâm (i = -1: giữa màn hình). */
    const clickPlayer = async (i: number) => {
      if (i >= 0 && !(await evalMain(SHOW_PLAYER(i)))) return;
      await sleep(700); // iframe lazyload bắt đầu tải khi lọt vào màn hình
      const center = i >= 0 ? ((await evalMain(PLAYER_CENTER(i))) as number[] | null | undefined) : null;
      const [x, y] = center ?? [VIEWPORT.width / 2, VIEWPORT.height / 2];
      await mouse("mouseMoved", x, y);
      await mouse("mousePressed", x, y, { button: "left", clickCount: 1 });
      await mouse("mouseReleased", x, y, { button: "left", clickCount: 1 });
    };

    await waitForPage();
    locked = true;
    // Vẫn bị chặn bởi màn hình xác minh "bạn là con người": dừng, không thao tác gì trên trang
    // (không tự bấm/giải ô xác minh — đó là cơ chế chống bot của website)
    const blocked = CHALLENGE.test(String((await evalMain("document.title")) ?? ""));
    if (blocked) deadline = Date.now();

    // Mỗi lượt: cuộn tới chân trang -> đánh dấu mọi khung trình phát -> play() mọi frame -> bấm lần lượt từng khung.
    // Lượt sau chỉ bấm lại khung chưa ra link (lần bấm đầu hay bị quảng cáo chiếm, hoặc trình phát nạp chậm).
    let players: string[] = [];
    let triedWatchLink = false;
    const silent = new Set<number>();
    for (let round = 0; round < 3 && timeLeft() > 0 && !blocked; round++) {
      if (round > 0 && failedFrames.size) {
        await evalMain(RELOAD_FRAMES([...failedFrames]));
        failedFrames.clear();
        await sleep(2500);
      }
      await scrollThrough(round === 0 ? 40 : 12);
      players = ((await evalMain(MARK_PLAYERS_SCRIPT)) as string[] | undefined) ?? [];
      const targets = players.length ? players.map((_, i) => i) : [-1];
      let before = videoCount();
      await playAll();
      await waitForNew(before, round === 0 ? 4000 : 2500);
      for (const i of targets) {
        if (timeLeft() <= 0 || videoCount() >= targets.length) break; // khung nào cũng đã ra link
        if (round > 0 && !silent.has(i)) continue;
        before = videoCount();
        await clickPlayer(i);
        await waitForNew(before, round === 0 ? 4500 : 3000);
        if (videoCount() > before) silent.delete(i);
        else silent.add(i);
      }
      if (videoCount() >= targets.length || (videoCount() > 0 && (round > 0 || silent.size > 6))) break;
      if (!videoCount() && !triedWatchLink && !players.some((tag) => tag === "iframe" || tag === "video")) {
        // Chưa thấy gì và chưa có khung trình phát: đang ở trang thông tin phim? -> mở trang "Xem phim" rồi làm lại
        triedWatchLink = true;
        const link = (await evalMain(WATCH_LINK_SCRIPT)) as string | null | undefined;
        if (link && siteOf(link) === siteOf(homeUrl)) {
          loaded = false;
          allowNavTo = link;
          deadline += 15_000;
          silent.clear();
          await quiet(send("Page.navigate", { url: link }, mainSession));
          await waitForPage();
          allowNavTo = null;
          round = -1;
        }
      }
    }

    // Chờ đọc xong nội dung các playlist (biết playlist tổng để gộp các playlist con của nó)
    for (let i = 0; i < 25 && pendingBodies > 0; i++) await sleep(200);
    if (videoCount() && ![...found.values()].some((m) => m.master)) await sleep(1500); // playlist tổng có thể tới sau

    const title = ((await evalMain("document.title")) as string | undefined) || null;
    // Giữ thứ tự xuất hiện (gần với thứ tự khung trên trang); link chỉ thấy trong dữ liệu và mp4 nhỏ xếp sau
    const rank = (m: SniffedMedia) => (m.fromBody ? 10 : 0) + (isSmallMp4(m) ? 5 : 0);
    // Cùng một video nhưng khác token (bấm phát nhiều lần) -> giữ link mới nhất mà trình phát đã tải
    const unique = new Map<string, SniffedMedia>();
    for (const m of found.values()) {
      if (isVariant(m)) continue;
      const k = dedupeKey(m.url);
      const prev = unique.get(k);
      if (!prev || prev.fromBody || !m.fromBody) unique.set(k, m);
    }
    const media = [...unique.values()].sort((a, b) => rank(a) - rank(b)).slice(0, MAX_RESULTS);

    // Không dò được: chụp màn hình để biết trình duyệt ẩn thấy gì (logs/sniff-last.jpg)
    let screenshot: string | null = null;
    if (!media.length) {
      const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 60 }, mainSession).catch(() => null);
      if (shot?.data) {
        screenshot = path.join(process.cwd(), "logs", "sniff-last.jpg");
        await fs.promises.mkdir(path.dirname(screenshot), { recursive: true }).catch(() => undefined);
        await fs.promises.writeFile(screenshot, Buffer.from(String(shot.data), "base64")).catch(() => (screenshot = null));
      }
    }

    const result: SniffResult = {
      media,
      title,
      finalUrl: homeUrl,
      frames: frames.size,
      players,
      challenge: CHALLENGE.test(title ?? ""),
      screenshot,
    };
    console.info(
      `[sniff] ${pageUrl} -> ${homeUrl} "${title ?? ""}" ${((Date.now() - started) / 1000).toFixed(1)}s, ` +
        `${frames.size} frame, ${players.length} khung phát (${players.join(",")}), ${requests.size} request, ${media.length} link` +
        (media[0] ? `: ${media[0].url}` : screenshot ? `, ảnh: ${screenshot}` : ""),
    );
    return result;
  } finally {
    try {
      ws?.close();
    } catch {
      // bỏ qua
    }
    killTree(proc.pid);
    await sleep(600);
    await fs.promises.rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 }).catch(() => undefined);
  }
}
