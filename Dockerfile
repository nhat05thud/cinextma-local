# Đóng gói Cinextma để chạy trên VPS / cloud (Linux) khi đưa lên internet.
#   docker compose up -d --build
FROM node:24-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*
# yt-dlp (bản standalone, không cần Python) + Deno (yt-dlp cần để tải từ YouTube) cho tính năng "Lấy từ link"
ADD --chmod=755 https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux /usr/local/bin/yt-dlp
COPY --from=denoland/deno:bin /deno /usr/local/bin/deno
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production \
    DATABASE_URL=file:/data/db/cinextma.db \
    MEDIA_ROOT=/data/media \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    FFPROBE_PATH=/usr/bin/ffprobe \
    YTDLP_PATH=/usr/local/bin/yt-dlp \
    DENO_PATH=/usr/local/bin/deno
COPY --from=build /app ./
EXPOSE 3000
VOLUME ["/data/db", "/data/media"]
# Migration + seed (idempotent) rồi chạy web server
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && npx next start -p 3000"]
