ALTER TABLE "templates" ADD COLUMN "variants" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "options" jsonb DEFAULT '[]'::jsonb;