CREATE TABLE "chat_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uploader_id" uuid NOT NULL,
	"type" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "direct_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"body" text NOT NULL,
	"image_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "image_id" uuid;--> statement-breakpoint
ALTER TABLE "group_members" ADD COLUMN "last_read_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_images" ADD CONSTRAINT "chat_images_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_image_id_chat_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."chat_images"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_images_uploader_idx" ON "chat_images" USING btree ("uploader_id");--> statement-breakpoint
CREATE INDEX "direct_messages_pair_idx" ON "direct_messages" USING btree ("sender_id","recipient_id","id");--> statement-breakpoint
CREATE INDEX "direct_messages_unread_idx" ON "direct_messages" USING btree ("recipient_id","read_at");--> statement-breakpoint
CREATE INDEX "direct_messages_time_idx" ON "direct_messages" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_image_id_chat_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."chat_images"("id") ON DELETE set null ON UPDATE no action;