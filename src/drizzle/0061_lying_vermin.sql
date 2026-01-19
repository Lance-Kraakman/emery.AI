CREATE TABLE "security_findings" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"report_id" integer NOT NULL,
	"risk_level" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"finding_data" jsonb NOT NULL,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "security_findings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "security_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"created_by" uuid NOT NULL,
	"status" text DEFAULT 'generating' NOT NULL,
	"report_data" jsonb NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "security_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "security_findings" ADD CONSTRAINT "security_findings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_findings" ADD CONSTRAINT "security_findings_report_id_security_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."security_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_reports" ADD CONSTRAINT "security_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_reports" ADD CONSTRAINT "security_reports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "security_findings_org_idx" ON "security_findings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "security_findings_report_idx" ON "security_findings" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "security_findings_risk_level_idx" ON "security_findings" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX "security_findings_status_idx" ON "security_findings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "security_reports_org_idx" ON "security_reports" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "security_reports_status_idx" ON "security_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "security_reports_generated_idx" ON "security_reports" USING btree ("generated_at");--> statement-breakpoint
CREATE POLICY "security_findings_tenant_isolation" ON "security_findings" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
CREATE POLICY "security_reports_tenant_isolation" ON "security_reports" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "skills_view_permission" ON "skills" TO public USING (
      organization_id = current_setting('app.current_organization_id')::integer
      AND (
        (agent_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM agents a
          WHERE a.id = agent_id
          AND (
            a.owner_id = current_setting('app.current_user_id')::uuid
            OR user_has_permission(
              current_setting('app.current_user_id')::uuid,
              'agents:view',
              a.organization_id,
              'agent',
              a.id
            )
          )
        ))
        OR
        (agent_id IS NULL AND user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'skills:view',
          organization_id,
          'skill',
          id
        ))
      )
    );--> statement-breakpoint
ALTER POLICY "skills_manage_permission" ON "skills" TO public USING (
      organization_id = current_setting('app.current_organization_id')::integer
      AND (
        (agent_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM agents a
          WHERE a.id = agent_id
          AND (
            a.owner_id = current_setting('app.current_user_id')::uuid
            OR user_has_permission(
              current_setting('app.current_user_id')::uuid,
              'agents:manage',
              a.organization_id,
              'agent',
              a.id
            )
          )
        ))
        OR
        (agent_id IS NULL AND user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'skills:manage',
          organization_id,
          'skill',
          id
        ))
      )
    ) WITH CHECK (
      organization_id = current_setting('app.current_organization_id')::integer
      AND (
        (agent_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM agents a
          WHERE a.id = agent_id
          AND (
            a.owner_id = current_setting('app.current_user_id')::uuid
            OR user_has_permission(
              current_setting('app.current_user_id')::uuid,
              'agents:manage',
              a.organization_id,
              'agent',
              a.id
            )
          )
        ))
        OR
        (agent_id IS NULL AND user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'skills:manage',
          organization_id,
          'skill',
          id
        ))
      )
    );