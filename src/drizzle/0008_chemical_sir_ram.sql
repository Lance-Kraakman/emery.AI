ALTER TABLE "skills" ALTER COLUMN "agent_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "organization_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "skills_organization_idx" ON "skills" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "skills_agent_idx" ON "skills" USING btree ("agent_id");