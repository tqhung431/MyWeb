CREATE TABLE "watch_entries" (
	"user_id" uuid NOT NULL,
	"title_id" integer NOT NULL,
	"status" text NOT NULL,
	"stars" integer,
	"note" text DEFAULT '' NOT NULL,
	"episodes_seen" integer,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_entries_user_id_title_id_pk" PRIMARY KEY("user_id","title_id"),
	CONSTRAINT "watch_status_valid" CHECK ("watch_entries"."status" in ('want', 'watching', 'done', 'dropped')),
	CONSTRAINT "watch_stars_valid" CHECK ("watch_entries"."stars" is null or "watch_entries"."stars" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "watch_titles" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"original_title" text,
	"year" integer,
	"kind" text NOT NULL,
	"image_url" text,
	"summary" text DEFAULT '' NOT NULL,
	"genres" text[] DEFAULT '{}'::text[] NOT NULL,
	"rating" integer,
	"episodes" integer,
	"url" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "watch_entries" ADD CONSTRAINT "watch_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_entries" ADD CONSTRAINT "watch_entries_title_id_watch_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."watch_titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "watch_entries_title_idx" ON "watch_entries" USING btree ("title_id");--> statement-breakpoint
CREATE INDEX "watch_entries_updated_idx" ON "watch_entries" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "watch_titles_source_ext_idx" ON "watch_titles" USING btree ("source","external_id");