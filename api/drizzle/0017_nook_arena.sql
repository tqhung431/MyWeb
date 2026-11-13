CREATE TABLE "arena_ratings" (
	"user_id" uuid NOT NULL,
	"game" text NOT NULL,
	"rating" integer DEFAULT 1200 NOT NULL,
	"games" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "arena_ratings_user_id_game_pk" PRIMARY KEY("user_id","game")
);
--> statement-breakpoint
CREATE TABLE "chess_games" (
	"id" serial PRIMARY KEY NOT NULL,
	"white_id" uuid,
	"black_id" uuid,
	"white_name" text NOT NULL,
	"black_name" text NOT NULL,
	"mode" text NOT NULL,
	"nook_level" integer,
	"time_control" text NOT NULL,
	"pgn" text NOT NULL,
	"result" text NOT NULL,
	"reason" text NOT NULL,
	"ended_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tv_videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"youtube_id" text NOT NULL,
	"title" text NOT NULL,
	"shelf" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"added_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "arena_ratings" ADD CONSTRAINT "arena_ratings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chess_games" ADD CONSTRAINT "chess_games_white_id_users_id_fk" FOREIGN KEY ("white_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chess_games" ADD CONSTRAINT "chess_games_black_id_users_id_fk" FOREIGN KEY ("black_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_videos" ADD CONSTRAINT "tv_videos_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "arena_ratings_game_idx" ON "arena_ratings" USING btree ("game","rating");--> statement-breakpoint
CREATE INDEX "chess_games_white_idx" ON "chess_games" USING btree ("white_id");--> statement-breakpoint
CREATE INDEX "chess_games_black_idx" ON "chess_games" USING btree ("black_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tv_videos_kind_id_idx" ON "tv_videos" USING btree ("kind","youtube_id");--> statement-breakpoint
CREATE INDEX "tv_videos_shelf_idx" ON "tv_videos" USING btree ("shelf","position");