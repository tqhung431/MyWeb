-- Stage 8: songs are now files MyWeb stores itself. Songs that were only SoundCloud/YouTube links
-- have no file to keep, so they are removed (with their plays and likes).
DELETE FROM "songs";--> statement-breakpoint
ALTER TABLE "songs" DROP CONSTRAINT "songs_url_unique";--> statement-breakpoint
ALTER TABLE "songs" DROP CONSTRAINT "song_provider_valid";--> statement-breakpoint
ALTER TABLE "songs" DROP COLUMN "provider";--> statement-breakpoint
ALTER TABLE "songs" DROP COLUMN "url";--> statement-breakpoint
ALTER TABLE "songs" DROP COLUMN "embed_url";--> statement-breakpoint
ALTER TABLE "songs" DROP COLUMN "artwork_url";