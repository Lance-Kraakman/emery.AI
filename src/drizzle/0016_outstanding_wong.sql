CREATE TABLE "data_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"table_id" integer NOT NULL,
	"name" text NOT NULL,
	"filters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sorting" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pagination" jsonb DEFAULT '{"pageSize": 50, "offset": 0}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "data_sources_org_name_unique" UNIQUE("organization_id","name")
);
--> statement-breakpoint
ALTER TABLE "data_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "data_sources" ADD CONSTRAINT "data_sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_sources" ADD CONSTRAINT "data_sources_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "data_sources_org_idx" ON "data_sources" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "data_sources_table_idx" ON "data_sources" USING btree ("table_id");--> statement-breakpoint
CREATE POLICY "data_sources_view_permission" ON "data_sources" AS PERMISSIVE FOR SELECT TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:view',
        organization_id
      ));--> statement-breakpoint
CREATE POLICY "data_sources_create_permission" ON "data_sources" AS PERMISSIVE FOR INSERT TO public WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:manage',
        organization_id
      ));--> statement-breakpoint
CREATE POLICY "data_sources_manage_permission" ON "data_sources" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:manage',
        organization_id
      )) WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:manage',
        organization_id
      ));