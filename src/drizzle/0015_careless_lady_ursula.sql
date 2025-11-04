ALTER TABLE "databases" DROP CONSTRAINT "databases_slug_unique";--> statement-breakpoint
ALTER TABLE "databases" ADD CONSTRAINT "databases_org_slug_unique" UNIQUE("organization_id","slug");