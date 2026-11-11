ALTER TABLE "oauth_accounts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "oauth_accounts" CASCADE;--> statement-breakpoint
-- GitHub sign-in was removed. Accounts made only with GitHub have no password and could never sign in again.
DELETE FROM "users" WHERE "password_hash" IS NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "avatar_url";