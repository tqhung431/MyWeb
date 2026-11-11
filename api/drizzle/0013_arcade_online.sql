CREATE TABLE "online_game_players" (
	"game_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"correct" integer NOT NULL,
	"place" integer NOT NULL,
	"players" integer NOT NULL,
	CONSTRAINT "online_game_players_game_id_user_id_pk" PRIMARY KEY("game_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "online_games" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"category" text NOT NULL,
	"rounds" integer NOT NULL,
	"finished_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "online_game_players" ADD CONSTRAINT "online_game_players_game_id_online_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."online_games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_game_players" ADD CONSTRAINT "online_game_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "online_game_players_user_idx" ON "online_game_players" USING btree ("user_id");