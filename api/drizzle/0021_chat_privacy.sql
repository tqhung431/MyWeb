CREATE TABLE "sign_ins" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"how" text NOT NULL,
	"user_agent" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD COLUMN "deleted_by" text;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sign_ins" ADD CONSTRAINT "sign_ins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sign_ins_at_idx" ON "sign_ins" USING btree ("at");--> statement-breakpoint
CREATE INDEX "sign_ins_user_idx" ON "sign_ins" USING btree ("user_id");