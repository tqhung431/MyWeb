ALTER TABLE "songs" ADD COLUMN "file_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "sha256" text NOT NULL;--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "mime_type" text NOT NULL;--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "size_bytes" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "duration_sec" integer;--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "artwork_file" text;--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "license" text NOT NULL;--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "license_url" text;--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "credit" text;--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "songs" ADD CONSTRAINT "songs_file_name_unique" UNIQUE("file_name");--> statement-breakpoint
ALTER TABLE "songs" ADD CONSTRAINT "songs_sha256_unique" UNIQUE("sha256");