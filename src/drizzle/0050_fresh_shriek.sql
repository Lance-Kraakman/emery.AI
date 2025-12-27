ALTER TABLE "agents" ADD COLUMN "automations" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "page_dialogs" jsonb;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "tool_execution_config" jsonb;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "write_config" jsonb;--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "schedules";