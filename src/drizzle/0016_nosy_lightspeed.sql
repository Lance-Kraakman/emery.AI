CREATE TABLE "views" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"table_id" integer NOT NULL,
	"name" text NOT NULL,
	"filters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sorting" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pagination" jsonb DEFAULT '{"pageSize": 50, "offset": 0}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "views_org_name_unique" UNIQUE("organization_id","name")
);
--> statement-breakpoint
ALTER TABLE "views" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "views" ADD CONSTRAINT "views_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "views" ADD CONSTRAINT "views_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "views_org_idx" ON "views" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "views_table_idx" ON "views" USING btree ("table_id");--> statement-breakpoint
CREATE POLICY "views_view_permission" ON "views" AS PERMISSIVE FOR SELECT TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:view',
        organization_id
      ));--> statement-breakpoint
CREATE POLICY "views_create_permission" ON "views" AS PERMISSIVE FOR INSERT TO public WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:manage',
        organization_id
      ));--> statement-breakpoint
CREATE POLICY "views_manage_permission" ON "views" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer
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