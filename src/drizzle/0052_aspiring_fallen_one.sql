ALTER TABLE "skills" ALTER COLUMN "execution_type" SET DEFAULT 'agentic';--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "steps" jsonb;