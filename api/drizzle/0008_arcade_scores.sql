CREATE TABLE "game_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"game" text NOT NULL,
	"user_id" uuid,
	"client_id" uuid,
	"score" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_score_has_owner" CHECK ("game_scores"."user_id" is not null or "game_scores"."client_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "game_scores" ADD CONSTRAINT "game_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_scores_game_time_idx" ON "game_scores" USING btree ("game","created_at");--> statement-breakpoint
CREATE INDEX "game_scores_user_idx" ON "game_scores" USING btree ("user_id","game");--> statement-breakpoint
CREATE INDEX "game_scores_client_idx" ON "game_scores" USING btree ("client_id","game");