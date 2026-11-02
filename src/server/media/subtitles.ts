import fs from "node:fs";
import path from "node:path";
import { ffmpeg } from "./ffmpeg";

const LANGUAGES: Record<string, { code: string; label: string }> = {
  vi: { code: "vi", label: "Tiếng Việt" },
  vie: { code: "vi", label: "Tiếng Việt" },
  en: { code: "en", label: "Tiếng Anh" },
  eng: { code: "en", label: "Tiếng Anh" },
  zh: { code: "zh", label: "Tiếng Trung" },
  chi: { code: "zh", label: "Tiếng Trung" },
  zho: { code: "zh", label: "Tiếng Trung" },
  ja: { code: "ja", label: "Tiếng Nhật" },
  jpn: { code: "ja", label: "Tiếng Nhật" },
  ko: { code: "ko", label: "Tiếng Hàn" },
  kor: { code: "ko", label: "Tiếng Hàn" },
  th: { code: "th", label: "Tiếng Thái" },
  tha: { code: "th", label: "Tiếng Thái" },
  fr: { code: "fr", label: "Tiếng Pháp" },
  fre: { code: "fr", label: "Tiếng Pháp" },
  fra: { code: "fr", label: "Tiếng Pháp" },
  es: { code: "es", label: "Tiếng Tây Ban Nha" },
  spa: { code: "es", label: "Tiếng Tây Ban Nha" },
};

export const SUBTITLE_LANGUAGES = Object.values(LANGUAGES).filter(
  (lang, index, all) => all.findIndex((l) => l.code === lang.code) === index,
);

export const resolveLanguage = (raw?: string | null) => {
  const key = (raw ?? "").toLowerCase();
  return LANGUAGES[key] ?? { code: key || "und", label: key ? key.toUpperCase() : "Không rõ" };
};

/** Phụ đề dạng text có thể chuyển sang WebVTT (phụ đề dạng ảnh như PGS thì không). */
export const TEXT_SUBTITLE_CODECS = new Set(["subrip", "srt", "ass", "ssa", "mov_text", "webvtt", "text"]);

/** Giải mã file phụ đề: thử UTF-8 trước, sau đó Windows-1258 (tiếng Việt cũ) rồi Windows-1252. */
export const decodeSubtitle = (buffer: Buffer) => {
  for (const encoding of ["utf-8", "windows-1258", "windows-1252"]) {
    try {
      return new TextDecoder(encoding, { fatal: true }).decode(buffer).replace(/^﻿/, "");
    } catch {
      // thử encoding tiếp theo
    }
  }
  return buffer.toString("latin1");
};

export const srtToVtt = (srt: string) =>
  "WEBVTT\n\n" +
  srt
    .replace(/\r\n?/g, "\n")
    .replace(/^\d+\s*\n(?=\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->)/gm, "")
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")
    .trim() +
  "\n";

/**
 * Chuyển file phụ đề upload (.srt, .vtt, .ass, .ssa) thành WebVTT tại `output`.
 */
export const convertSubtitleFile = async (buffer: Buffer, extension: string, output: string) => {
  await fs.promises.mkdir(path.dirname(output), { recursive: true });
  const ext = extension.toLowerCase().replace(/^\./, "");

  if (ext === "vtt") {
    const text = decodeSubtitle(buffer);
    await fs.promises.writeFile(output, text.startsWith("WEBVTT") ? text : `WEBVTT\n\n${text}`, "utf-8");
    return;
  }
  if (ext === "srt") {
    await fs.promises.writeFile(output, srtToVtt(decodeSubtitle(buffer)), "utf-8");
    return;
  }
  // ass/ssa/...: để ffmpeg chuyển đổi
  const temp = `${output}.src.${ext}`;
  await fs.promises.writeFile(temp, decodeSubtitle(buffer), "utf-8");
  try {
    await ffmpeg(["-i", temp, "-c:s", "webvtt", output]);
  } finally {
    await fs.promises.rm(temp, { force: true });
  }
};
