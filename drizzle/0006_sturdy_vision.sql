ALTER TABLE "fields" RENAME COLUMN "related_table_id" TO "field_config";--> statement-breakpoint
ALTER TABLE "tables" RENAME COLUMN "db_name" TO "s3_path";--> statement-breakpoint
ALTER TABLE "tables" DROP CONSTRAINT "tables_db_name_unique";--> statement-breakpoint
ALTER TABLE "fields" DROP CONSTRAINT "fields_related_table_id_tables_id_fk";
--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_s3_path_unique" UNIQUE("s3_path");