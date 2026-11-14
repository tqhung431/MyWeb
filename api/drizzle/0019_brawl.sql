CREATE TABLE "brawl_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"hero" text NOT NULL,
	"players" integer NOT NULL,
	"areas" integer NOT NULL,
	"won" boolean NOT NULL,
	"time_ms" integer NOT NULL,
	"bonks" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brawl_runs" ADD CONSTRAINT "brawl_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brawl_runs_user_idx" ON "brawl_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "brawl_runs_best_idx" ON "brawl_runs" USING btree ("areas","time_ms");