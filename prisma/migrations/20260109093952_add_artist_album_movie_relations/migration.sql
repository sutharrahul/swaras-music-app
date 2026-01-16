-- CreateEnum
CREATE TYPE "CreditRole" AS ENUM ('PRIMARY_ARTIST', 'FEATURED_ARTIST', 'PRODUCER', 'COMPOSER', 'LYRICIST', 'ARRANGER');

-- CreateEnum
CREATE TYPE "AlbumType" AS ENUM ('ALBUM', 'SINGLE', 'EP', 'COMPILATION', 'SOUNDTRACK');

-- AlterTable
ALTER TABLE "songs" ADD COLUMN     "album_id" TEXT,
ADD COLUMN     "genre" TEXT,
ADD COLUMN     "lyrics" TEXT,
ADD COLUMN     "movie_id" TEXT,
ALTER COLUMN "cover_url" DROP NOT NULL;

-- CreateTable
CREATE TABLE "artists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "image_url" TEXT,
    "country" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "albums" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "AlbumType" NOT NULL DEFAULT 'ALBUM',
    "release_year" INTEGER,
    "cover_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "albums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movies" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "release_year" INTEGER,
    "poster_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "movies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "song_credits" (
    "song_id" TEXT NOT NULL,
    "artist_id" TEXT NOT NULL,
    "role" "CreditRole" NOT NULL,

    CONSTRAINT "song_credits_pkey" PRIMARY KEY ("song_id","artist_id","role")
);

-- CreateTable
CREATE TABLE "_AlbumArtist" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AlbumArtist_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "artists_name_key" ON "artists"("name");

-- CreateIndex
CREATE INDEX "artists_name_idx" ON "artists"("name");

-- CreateIndex
CREATE INDEX "albums_title_idx" ON "albums"("title");

-- CreateIndex
CREATE INDEX "albums_type_idx" ON "albums"("type");

-- CreateIndex
CREATE UNIQUE INDEX "movies_title_key" ON "movies"("title");

-- CreateIndex
CREATE INDEX "movies_title_idx" ON "movies"("title");

-- CreateIndex
CREATE INDEX "song_credits_artist_id_idx" ON "song_credits"("artist_id");

-- CreateIndex
CREATE INDEX "song_credits_role_idx" ON "song_credits"("role");

-- CreateIndex
CREATE INDEX "_AlbumArtist_B_index" ON "_AlbumArtist"("B");

-- CreateIndex
CREATE INDEX "songs_title_idx" ON "songs"("title");

-- CreateIndex
CREATE INDEX "songs_genre_idx" ON "songs"("genre");

-- CreateIndex
CREATE INDEX "songs_album_id_idx" ON "songs"("album_id");

-- CreateIndex
CREATE INDEX "songs_movie_id_idx" ON "songs"("movie_id");

-- AddForeignKey
ALTER TABLE "songs" ADD CONSTRAINT "songs_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "songs" ADD CONSTRAINT "songs_movie_id_fkey" FOREIGN KEY ("movie_id") REFERENCES "movies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_credits" ADD CONSTRAINT "song_credits_song_id_fkey" FOREIGN KEY ("song_id") REFERENCES "songs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_credits" ADD CONSTRAINT "song_credits_artist_id_fkey" FOREIGN KEY ("artist_id") REFERENCES "artists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AlbumArtist" ADD CONSTRAINT "_AlbumArtist_A_fkey" FOREIGN KEY ("A") REFERENCES "albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AlbumArtist" ADD CONSTRAINT "_AlbumArtist_B_fkey" FOREIGN KEY ("B") REFERENCES "artists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
