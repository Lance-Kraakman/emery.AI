-- Add steps column for step-based agent execution
ALTER TABLE "skills" ADD COLUMN "steps" jsonb;--> statement-breakpoint

-- Change default from 'agent' to 'agentic'
ALTER TABLE "skills" ALTER COLUMN "execution_type" SET DEFAULT 'agentic';--> statement-breakpoint

-- Migrate existing skills with execution_type='agent' to 'agentic'
-- (they were all using flat instructions, the new 'agent' type is for step-based)
UPDATE "skills" SET "execution_type" = 'agentic' WHERE "execution_type" = 'agent';