ALTER TABLE "views" ADD COLUMN "view_type" text DEFAULT 'grid' NOT NULL;--> statement-breakpoint
ALTER TABLE "views" ADD COLUMN "view_config" jsonb DEFAULT '{"type": "grid"}'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "views_type_idx" ON "views" USING btree ("view_type");