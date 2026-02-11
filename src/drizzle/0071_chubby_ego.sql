ALTER TABLE "skills" ADD COLUMN "human_skill_config" jsonb;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "current_step_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "pending_human_steps" jsonb;