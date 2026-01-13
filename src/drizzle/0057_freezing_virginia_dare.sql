CREATE TABLE "context_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"table_id" bigint NOT NULL,
	"table_name" text NOT NULL,
	"access_mode" text DEFAULT 'read' NOT NULL,
	"sync_mode" text DEFAULT 'on_access' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "context_mappings_target_table_unique" UNIQUE("target_type","target_id","table_id")
);
--> statement-breakpoint
ALTER TABLE "context_mappings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "context_sync_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"mapping_id" integer NOT NULL,
	"last_synced_at" timestamp,
	"last_synced_version" integer,
	"direction" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"row_count" integer,
	"bytes_transferred" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "context_sync_state_session_mapping_unique" UNIQUE("session_id","mapping_id")
);
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "plan" jsonb;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "plan_generated_at" timestamp;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "plan_approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "context_mappings" ADD CONSTRAINT "context_mappings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_mappings" ADD CONSTRAINT "context_mappings_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_mappings" ADD CONSTRAINT "context_mappings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "context_sync_state" ADD CONSTRAINT "context_sync_state_mapping_id_context_mappings_id_fk" FOREIGN KEY ("mapping_id") REFERENCES "public"."context_mappings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "context_mappings_target_idx" ON "context_mappings" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "context_mappings_table_idx" ON "context_mappings" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "context_mappings_org_idx" ON "context_mappings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "context_sync_state_session_idx" ON "context_sync_state" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "context_sync_state_mapping_idx" ON "context_sync_state" USING btree ("mapping_id");--> statement-breakpoint
CREATE POLICY "context_mappings_tenant_isolation" ON "context_mappings" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
CREATE POLICY "context_mappings_view_permission" ON "context_mappings" AS PERMISSIVE FOR SELECT TO public USING (
      organization_id = current_setting('app.current_organization_id')::integer
      AND (
        (target_type = 'agent' AND EXISTS (
          SELECT 1 FROM agents a
          WHERE a.id = target_id::integer
          AND a.organization_id = organization_id
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
        (target_type = 'skill' AND EXISTS (
          SELECT 1 FROM skills s
          WHERE s.id = target_id::integer
          AND s.organization_id = organization_id
          AND (
            s.owner_id = current_setting('app.current_user_id')::uuid
            OR user_has_permission(
              current_setting('app.current_user_id')::uuid,
              'skills:view',
              s.organization_id,
              'skill',
              s.id
            )
          )
        ))
        OR
        (target_type = 'skill_step' AND EXISTS (
          SELECT 1 FROM skills s
          WHERE s.organization_id = organization_id
          AND s.steps::jsonb @> ('[{"id":"' || target_id || '"}]')::jsonb
          AND (
            s.owner_id = current_setting('app.current_user_id')::uuid
            OR user_has_permission(
              current_setting('app.current_user_id')::uuid,
              'skills:view',
              s.organization_id,
              'skill',
              s.id
            )
          )
        ))
      )
    );--> statement-breakpoint
CREATE POLICY "context_mappings_manage_permission" ON "context_mappings" AS PERMISSIVE FOR ALL TO public USING (
      organization_id = current_setting('app.current_organization_id')::integer
      AND (
        (target_type = 'agent' AND EXISTS (
          SELECT 1 FROM agents a
          WHERE a.id = target_id::integer
          AND a.organization_id = organization_id
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
        (target_type = 'skill' AND EXISTS (
          SELECT 1 FROM skills s
          WHERE s.id = target_id::integer
          AND s.organization_id = organization_id
          AND (
            s.owner_id = current_setting('app.current_user_id')::uuid
            OR user_has_permission(
              current_setting('app.current_user_id')::uuid,
              'skills:manage',
              s.organization_id,
              'skill',
              s.id
            )
          )
        ))
        OR
        (target_type = 'skill_step' AND EXISTS (
          SELECT 1 FROM skills s
          WHERE s.organization_id = organization_id
          AND s.steps::jsonb @> ('[{"id":"' || target_id || '"}]')::jsonb
          AND (
            s.owner_id = current_setting('app.current_user_id')::uuid
            OR user_has_permission(
              current_setting('app.current_user_id')::uuid,
              'skills:manage',
              s.organization_id,
              'skill',
              s.id
            )
          )
        ))
      )
    );