/** Đoán thông tin phim từ tên file hoặc tiêu đề video (dùng chung client + server). */

/** "Avatar.The.Way.of.Water.2022.1080p.BluRay.x264.mkv" -> { title: "Avatar The Way of Water", year: 2022 } */
export const parseMovieFileName = (name: string) => {
  let base = name.replace(/\.[^.]+$/, "").replace(/[._]+/g, " ");
  const year = /\b(19\d{2}|20\d{2})\b/.exec(base);
  if (year) base = base.slice(0, year.index);
  base = base
    .replace(/\b(2160p|1080p|720p|480p|4k|uhd|hdr|bluray|blu-ray|web-?dl|webrip|hdtv|dvdrip|x26[45]|h ?26[45]|hevc|aac|ac3|dts|vietsub|thuyet minh|long tieng)\b.*$/i, "")
    .replace(/[[(].*?[\])]/g, "")
    .replace(/\s+-\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return { title: base || name, year: year ? Number(year[1]) : null };
};

/** Đoán phần/tập từ tên file: S01E05, Tập 5, Ep05, ... hoặc số cuối cùng trong tên. */
export const parseEpisodeFromName = (name: string, fallbackSeason: number, fallbackEpisode: number) => {
  const base = name.replace(/\.[^.]+$/, "");
  const se = /S(\d{1,2})[ ._-]*E(\d{1,4})/i.exec(base);
  if (se) return { season: Number(se[1]), episode: Number(se[2]) };
  // \b: không bắt nhầm chữ "e" ở cuối một từ
  const ep = /\b(?:t[aậ]p|ep(?:isode)?|e)[ ._-]*(\d{1,4})/i.exec(base);
  if (ep) return { season: fallbackSeason, episode: Number(ep[1]) };
  const ignore = new Set(["2160", "1080", "720", "480", "360", "264", "265"]);
  const numbers = (base.match(/\d{1,4}/g) ?? []).filter((n) => !ignore.has(n) && !(n.length === 4 && Number(n) > 1900 && Number(n) < 2100));
  if (numbers.length) return { season: fallbackSeason, episode: Number(numbers[numbers.length - 1]) };
  return { season: fallbackSeason, episode: fallbackEpisode };
};
