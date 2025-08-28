ALTER TABLE "chats" DROP CONSTRAINT "chats_table_id_tables_id_fk";
--> statement-breakpoint
ALTER TABLE "chats" DROP COLUMN "domain_type";--> statement-breakpoint
ALTER TABLE "chats" DROP COLUMN "domain_id";--> statement-breakpoint
ALTER TABLE "chats" DROP COLUMN "table_id";