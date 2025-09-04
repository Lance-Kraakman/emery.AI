DROP POLICY "rag_indexes_creator_control" ON "rag_indexes" CASCADE;
--> statement-breakpoint
ALTER TABLE "rag_indexes" DROP CONSTRAINT "rag_indexes_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "rag_indexes" DROP COLUMN "created_by";