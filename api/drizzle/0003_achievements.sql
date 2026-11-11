CREATE TABLE "achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"client_id" uuid,
	"code" text NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "achievement_has_owner" CHECK ("achievements"."user_id" is not null or "achievements"."client_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "achievements_user_code_idx" ON "achievements" USING btree ("user_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "achievements_client_code_idx" ON "achievements" USING btree ("client_id","code");