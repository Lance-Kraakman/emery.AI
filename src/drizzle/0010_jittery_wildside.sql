ALTER TABLE "agents" ADD COLUMN "schedules" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "trigger";--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "capabilities";