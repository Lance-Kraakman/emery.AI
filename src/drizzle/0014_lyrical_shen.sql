CREATE TABLE "puck_apps" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "puck_apps_org_slug_unique" UNIQUE("organization_id","slug")
);
--> statement-breakpoint
ALTER TABLE "puck_apps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "puck_pages" (
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
	CONSTRAINT "puck_pages_app_slug_unique" UNIQUE("app_id","slug")
);
--> statement-breakpoint
ALTER TABLE "puck_pages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "puck_apps" ADD CONSTRAINT "puck_apps_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "puck_apps" ADD CONSTRAINT "puck_apps_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "puck_pages" ADD CONSTRAINT "puck_pages_app_id_puck_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."puck_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "puck_pages" ADD CONSTRAINT "puck_pages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "puck_apps_org_idx" ON "puck_apps" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "puck_pages_app_idx" ON "puck_pages" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "puck_pages_order_idx" ON "puck_pages" USING btree ("app_id","order");--> statement-breakpoint
CREATE POLICY "puck_apps_tenant_isolation" ON "puck_apps" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
CREATE POLICY "puck_pages_tenant_isolation" ON "puck_pages" AS PERMISSIVE FOR ALL TO public USING (EXISTS (
      SELECT 1 FROM puck_apps a
      WHERE a.id = app_id
      AND a.organization_id = current_setting('app.current_organization_id')::integer
    ));