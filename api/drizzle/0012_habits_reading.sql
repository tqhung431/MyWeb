CREATE TABLE "books" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"author" text DEFAULT '' NOT NULL,
	"total_pages" integer,
	"current_page" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'reading' NOT NULL,
	"started_on" date,
	"finished_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "book_status_valid" CHECK ("books"."status" in ('want', 'reading', 'finished'))
);
--> statement-breakpoint
CREATE TABLE "habit_days" (
	"habit_id" integer NOT NULL,
	"day" date NOT NULL,
	CONSTRAINT "habit_days_habit_id_day_pk" PRIMARY KEY("habit_id","day")
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"emoji" text NOT NULL,
	"color" text DEFAULT 'violet' NOT NULL,
	"per_week" integer DEFAULT 7 NOT NULL,
	"reminder_time" text,
	"time_zone" text DEFAULT 'UTC' NOT NULL,
	"last_reminded_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "habit_per_week_valid" CHECK ("habits"."per_week" between 1 and 7)
);
--> statement-breakpoint
CREATE TABLE "reading_log" (
	"book_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"pages" integer NOT NULL,
	CONSTRAINT "reading_log_book_id_day_pk" PRIMARY KEY("book_id","day")
);
--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_days" ADD CONSTRAINT "habit_days_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_log" ADD CONSTRAINT "reading_log_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_log" ADD CONSTRAINT "reading_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "books_user_idx" ON "books" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "habits_user_idx" ON "habits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "habits_reminder_idx" ON "habits" USING btree ("reminder_time");--> statement-breakpoint
CREATE INDEX "reading_log_user_day_idx" ON "reading_log" USING btree ("user_id","day");