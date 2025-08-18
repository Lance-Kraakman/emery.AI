ALTER TABLE "rag_documents" ALTER COLUMN "embedding" SET DATA TYPE vector(1024);--> statement-breakpoint
ALTER TABLE "rag_indexes" ALTER COLUMN "embedding_model" SET DEFAULT 'BAAI/bge-large-en-v1.5';--> statement-breakpoint
ALTER TABLE "rag_indexes" ALTER COLUMN "embedding_dimensions" SET DEFAULT 1024;--> statement-breakpoint
ALTER TABLE "rag_query_logs" ALTER COLUMN "query_embedding" SET DATA TYPE vector(1024);