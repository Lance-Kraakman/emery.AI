ALTER TABLE "agents" DROP CONSTRAINT "agents_api_key_hash_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_api_key_hash_unique";--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "api_key_hash";--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "api_key_prefix";--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "previous_api_key_hash";--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "previous_api_key_expires_at";--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "last_used_at";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "api_key_hash";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "api_key_prefix";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "previous_api_key_hash";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "previous_api_key_expires_at";