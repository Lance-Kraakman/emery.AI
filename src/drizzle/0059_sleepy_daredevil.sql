CREATE TABLE "entity_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"owner_id" uuid,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"category" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"entity_type" text NOT NULL,
	"template_data" jsonb NOT NULL,
	"version" text DEFAULT '1.0.0',
	"is_builtin" boolean DEFAULT false,
	"source_builtin_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "entity_templates_org_name_type_unique" UNIQUE("organization_id","name","entity_type")
);
--> statement-breakpoint
ALTER TABLE "entity_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "entity_templates" ADD CONSTRAINT "entity_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_templates" ADD CONSTRAINT "entity_templates_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entity_templates_org_type_idx" ON "entity_templates" USING btree ("organization_id","entity_type");--> statement-breakpoint
CREATE INDEX "entity_templates_category_idx" ON "entity_templates" USING btree ("organization_id","category");--> statement-breakpoint
CREATE INDEX "entity_templates_owner_idx" ON "entity_templates" USING btree ("owner_id");--> statement-breakpoint
CREATE POLICY "entity_templates_tenant_isolation" ON "entity_templates" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
CREATE POLICY "entity_templates_view_permission" ON "entity_templates" AS PERMISSIVE FOR SELECT TO public USING (
      organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'templates:view',
        organization_id,
        'template',
        id
      )
    );--> statement-breakpoint
CREATE POLICY "entity_templates_manage_permission" ON "entity_templates" AS PERMISSIVE FOR ALL TO public USING (
      organization_id = current_setting('app.current_organization_id')::integer
      AND (
        owner_id = current_setting('app.current_user_id')::uuid
        OR user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'templates:manage',
          organization_id,
          'template',
          id
        )
      )
    );