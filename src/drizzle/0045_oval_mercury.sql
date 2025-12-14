ALTER TABLE "skills" ADD COLUMN "execution_type" text DEFAULT 'agent';--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "task_model_config" jsonb;