CREATE TABLE "game_saves" (
	"user_id" uuid NOT NULL,
	"game" text NOT NULL,
	"version" integer NOT NULL,
	"data" jsonb NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_saves_user_id_game_pk" PRIMARY KEY("user_id","game")
);
--> statement-breakpoint
ALTER TABLE "game_saves" ADD CONSTRAINT "game_saves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;