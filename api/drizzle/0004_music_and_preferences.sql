CREATE TABLE "song_likes" (
	"song_id" integer NOT NULL,
	"owner" text NOT NULL,
	"liked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "song_likes_song_id_owner_pk" PRIMARY KEY("song_id","owner")
);
--> statement-breakpoint
CREATE TABLE "song_plays" (
	"id" serial PRIMARY KEY NOT NULL,
	"song_id" integer NOT NULL,
	"owner" text NOT NULL,
	"played_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "songs" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"url" text NOT NULL,
	"embed_url" text NOT NULL,
	"title" text NOT NULL,
	"artist" text NOT NULL,
	"artwork_url" text,
	"genre" text NOT NULL,
	"added_by_user_id" uuid,
	"added_by_client_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "songs_url_unique" UNIQUE("url"),
	CONSTRAINT "song_provider_valid" CHECK ("songs"."provider" in ('soundcloud', 'youtube')),
	CONSTRAINT "song_genre_valid" CHECK ("songs"."genre" in ('drill', 'remix', 'pop', 'lofi'))
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "preferences" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "song_likes" ADD CONSTRAINT "song_likes_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_plays" ADD CONSTRAINT "song_plays_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "songs" ADD CONSTRAINT "songs_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "song_likes_time_idx" ON "song_likes" USING btree ("liked_at");--> statement-breakpoint
CREATE INDEX "song_plays_time_idx" ON "song_plays" USING btree ("played_at","song_id");--> statement-breakpoint
CREATE INDEX "song_plays_owner_idx" ON "song_plays" USING btree ("owner","song_id","played_at");