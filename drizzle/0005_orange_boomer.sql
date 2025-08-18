ALTER TABLE "rag_indexes" ALTER COLUMN "embedding_model" SET DEFAULT 'BAAI/bge-m3';--> statement-breakpoint
ALTER TABLE "rag_query_logs" ADD COLUMN "similarity_metric" text;--> statement-breakpoint
ALTER TABLE "rag_query_logs" ADD COLUMN "threshold" integer;--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "tools";--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "servers";