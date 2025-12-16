CREATE TABLE "apps" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "apps_org_slug_unique" UNIQUE("organization_id","slug")
);
--> statement-breakpoint
ALTER TABLE "apps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_id" integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"order" integer DEFAULT 0 NOT NULL,
	"template_data" jsonb NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pages_app_slug_unique" UNIQUE("app_id","slug")
);
--> statement-breakpoint
ALTER TABLE "pages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "apps" ADD CONSTRAINT "apps_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apps" ADD CONSTRAINT "apps_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "apps_org_idx" ON "apps" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "pages_app_idx" ON "pages" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "pages_order_idx" ON "pages" USING btree ("app_id","order");--> statement-breakpoint
CREATE POLICY "apps_view_permission" ON "apps" AS PERMISSIVE FOR SELECT TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'apps:view',
        current_setting('app.current_organization_id')::integer
      ));--> statement-breakpoint
CREATE POLICY "apps_create_permission" ON "apps" AS PERMISSIVE FOR INSERT TO public WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'apps:create',
        current_setting('app.current_organization_id')::integer
      ));--> statement-breakpoint
CREATE POLICY "apps_manage_permission" ON "apps" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'apps:manage',
        current_setting('app.current_organization_id')::integer
      ));--> statement-breakpoint
CREATE POLICY "apps_public_read" ON "apps" AS PERMISSIVE FOR SELECT TO public USING (EXISTS (
      SELECT 1 FROM pages p
      WHERE p.app_id = id
      AND p.is_published = true
    ));--> statement-breakpoint
CREATE POLICY "pages_view_permission" ON "pages" AS PERMISSIVE FOR SELECT TO public USING (EXISTS (
      SELECT 1 FROM apps a
      WHERE a.id = app_id
      AND a.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'apps:view',
        current_setting('app.current_organization_id')::integer
      )
    ));--> statement-breakpoint
CREATE POLICY "pages_manage_permission" ON "pages" AS PERMISSIVE FOR ALL TO public USING (EXISTS (
      SELECT 1 FROM apps a
      WHERE a.id = app_id
      AND a.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'apps:manage',
        current_setting('app.current_organization_id')::integer
      )
    ));--> statement-breakpoint
CREATE POLICY "pages_publish_permission" ON "pages" AS PERMISSIVE FOR UPDATE TO public USING (EXISTS (
      SELECT 1 FROM apps a
      WHERE a.id = app_id
      AND a.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'apps:publish',
        current_setting('app.current_organization_id')::integer
      )
    ));--> statement-breakpoint
CREATE POLICY "pages_public_read" ON "pages" AS PERMISSIVE FOR SELECT TO public USING (is_published = true);