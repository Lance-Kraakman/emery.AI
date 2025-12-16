DROP POLICY IF EXISTS "rag_documents_manage_permission" ON "rag_documents" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "rag_documents_view_permission" ON "rag_documents" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "rag_documents" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "rag_indexes_manage_permission" ON "rag_indexes" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "rag_indexes_view_permission" ON "rag_indexes" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "rag_indexes" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "rag_query_logs_manage_permission" ON "rag_query_logs" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "rag_query_logs_view_permission" ON "rag_query_logs" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "rag_query_logs" CASCADE;