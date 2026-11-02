-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Title" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "originalTitle" TEXT,
    "tagline" TEXT,
    "overview" TEXT,
    "releaseDate" DATETIME,
    "year" INTEGER,
    "runtime" INTEGER,
    "ageRating" TEXT,
    "quality" TEXT,
    "country" TEXT,
    "language" TEXT,
    "rating" REAL NOT NULL DEFAULT 0,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "posterPath" TEXT,
    "backdropPath" TEXT,
    "logoPath" TEXT,
    "trailerUrl" TEXT,
    "tmdbId" INTEGER,
    "imdbId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "seriesStatus" TEXT,
    "totalEpisodes" INTEGER,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "searchText" TEXT NOT NULL DEFAULT '',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "videoId" TEXT,
    CONSTRAINT "Title_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Title" ("ageRating", "backdropPath", "country", "createdAt", "featured", "id", "imdbId", "language", "logoPath", "originalTitle", "overview", "posterPath", "publishedAt", "quality", "rating", "releaseDate", "runtime", "seriesStatus", "slug", "status", "tagline", "title", "tmdbId", "totalEpisodes", "trailerUrl", "type", "updatedAt", "videoId", "viewCount", "voteCount", "year") SELECT "ageRating", "backdropPath", "country", "createdAt", "featured", "id", "imdbId", "language", "logoPath", "originalTitle", "overview", "posterPath", "publishedAt", "quality", "rating", "releaseDate", "runtime", "seriesStatus", "slug", "status", "tagline", "title", "tmdbId", "totalEpisodes", "trailerUrl", "type", "updatedAt", "videoId", "viewCount", "voteCount", "year" FROM "Title";
DROP TABLE "Title";
ALTER TABLE "new_Title" RENAME TO "Title";
CREATE UNIQUE INDEX "Title_slug_key" ON "Title"("slug");
CREATE UNIQUE INDEX "Title_videoId_key" ON "Title"("videoId");
CREATE INDEX "Title_type_status_publishedAt_idx" ON "Title"("type", "status", "publishedAt");
CREATE INDEX "Title_status_viewCount_idx" ON "Title"("status", "viewCount");
CREATE UNIQUE INDEX "Title_type_tmdbId_key" ON "Title"("type", "tmdbId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
