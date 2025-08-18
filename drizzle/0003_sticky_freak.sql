ALTER TABLE "rag_documents" ALTER COLUMN "embedding" SET DATA TYPE vector(768);--> statement-breakpoint
ALTER TABLE "rag_indexes" ALTER COLUMN "embedding_model" SET DEFAULT 'sentence-transformers/all-mpnet-base-v2';--> statement-breakpoint
ALTER TABLE "rag_indexes" ALTER COLUMN "embedding_dimensions" SET DEFAULT 768;--> statement-breakpoint
ALTER TABLE "rag_query_logs" ALTER COLUMN "query_embedding" SET DATA TYPE vector(768);