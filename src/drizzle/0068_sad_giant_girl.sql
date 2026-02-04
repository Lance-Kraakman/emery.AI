ALTER TABLE "agents" DROP CONSTRAINT "agents_api_key_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_api_key_unique";--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "api_key_hash" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "api_key_prefix" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "previous_api_key_hash" text;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "previous_api_key_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "api_key_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "api_key_prefix" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "previous_api_key_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "previous_api_key_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "api_key";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "api_key";--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_api_key_hash_unique" UNIQUE("api_key_hash");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_api_key_hash_unique" UNIQUE("api_key_hash");