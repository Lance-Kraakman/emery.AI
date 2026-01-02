ALTER TABLE "agents" ADD COLUMN "webhook_token" text;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_webhook_token_unique" UNIQUE("webhook_token");--> statement-breakpoint
-- Backfill existing agents with webhook tokens
UPDATE agents SET webhook_token = gen_random_uuid()::text WHERE webhook_token IS NULL;