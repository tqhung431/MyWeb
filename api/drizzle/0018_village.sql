CREATE TABLE "village_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"map" text NOT NULL,
	"mode" text NOT NULL,
	"endless" boolean DEFAULT false NOT NULL,
	"waves" integer NOT NULL,
	"rice" integer NOT NULL,
	"won" boolean NOT NULL,
	"score" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "village_scores" ADD CONSTRAINT "village_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "village_scores_map_idx" ON "village_scores" USING btree ("map","score");--> statement-breakpoint
CREATE INDEX "village_scores_user_idx" ON "village_scores" USING btree ("user_id");