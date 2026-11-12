ALTER TABLE "game_saves" ADD COLUMN "path" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "game_saves" ADD COLUMN "level" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "game_saves" ADD COLUMN "kills" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "game_saves_board_idx" ON "game_saves" USING btree ("game","level");