CREATE TABLE "audit_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"event_category" text NOT NULL,
	"event_action" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"actor_name" text,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"resource_name" text,
	"parent_resource_type" text,
	"parent_resource_id" text,
	"event_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"previous_data" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"duration_ms" integer,
	"success" boolean DEFAULT true NOT NULL,
	"error" text,
	"expires_at" timestamp,
	"archived_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "row_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"table_id" bigint NOT NULL,
	"row_id" text NOT NULL,
	"operation" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"field_changes" jsonb,
	"row_snapshot" jsonb,
	"changed_by_type" text NOT NULL,
	"changed_by_id" text,
	"changed_by_name" text,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "row_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "task_tool_calls" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"organization_id" integer NOT NULL,
	"tool_name" text NOT NULL,
	"tool_input" jsonb,
	"tool_output" jsonb,
	"tool_error" text,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"duration_ms" integer,
	"call_index" integer NOT NULL,
	"tokens_used" integer DEFAULT 0
);
--> statement-breakpoint
ALTER TABLE "task_tool_calls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "row_history" ADD CONSTRAINT "row_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "row_history" ADD CONSTRAINT "row_history_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_tool_calls" ADD CONSTRAINT "task_tool_calls_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_tool_calls" ADD CONSTRAINT "task_tool_calls_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_org_occurred_idx" ON "audit_events" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_resource_idx" ON "audit_events" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("actor_type","actor_id");--> statement-breakpoint
CREATE INDEX "audit_events_expires_idx" ON "audit_events" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "row_history_table_row_idx" ON "row_history" USING btree ("table_id","row_id");--> statement-breakpoint
CREATE INDEX "row_history_org_time_idx" ON "row_history" USING btree ("organization_id","changed_at");--> statement-breakpoint
CREATE INDEX "row_history_expires_idx" ON "row_history" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "task_tool_calls_task_idx" ON "task_tool_calls" USING btree ("task_id","call_index");--> statement-breakpoint
CREATE INDEX "task_tool_calls_org_time_idx" ON "task_tool_calls" USING btree ("organization_id","started_at");--> statement-breakpoint
CREATE POLICY "audit_events_tenant_isolation" ON "audit_events" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
CREATE POLICY "row_history_tenant_isolation" ON "row_history" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
CREATE POLICY "task_tool_calls_tenant_isolation" ON "task_tool_calls" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer);