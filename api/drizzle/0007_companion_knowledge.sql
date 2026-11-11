-- Stage 9: pgvector adds the "vector" type and similarity search to PostgreSQL.
-- (docker-compose uses the pgvector/pgvector image; on your own PostgreSQL install the pgvector package.)
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "knowledge" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"ref_id" text NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"model" text NOT NULL,
	"embedding" vector(768) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_kind_ref_idx" ON "knowledge" USING btree ("kind","ref_id");--> statement-breakpoint
CREATE INDEX "knowledge_embedding_idx" ON "knowledge" USING hnsw ("embedding" vector_cosine_ops);