ALTER TABLE "organizations" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_slug_unique" UNIQUE("slug");