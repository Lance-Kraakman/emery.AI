ALTER TABLE "agents" ADD COLUMN "agent_type" text DEFAULT 'general';--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "analysis_capabilities" jsonb;