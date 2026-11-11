CREATE TABLE "focus_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"minutes" integer NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mode_valid" CHECK ("focus_sessions"."mode" in ('focus', 'short', 'long')),
	CONSTRAINT "minutes_valid" CHECK ("focus_sessions"."minutes" between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "tips" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"body" text[] NOT NULL,
	"minutes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tips_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "focus_sessions_client_time_idx" ON "focus_sessions" USING btree ("client_id","completed_at");