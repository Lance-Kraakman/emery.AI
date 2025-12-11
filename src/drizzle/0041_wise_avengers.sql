ALTER TABLE "templates" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "templates" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "templates_is_system_idx" ON "templates" USING btree ("is_system");--> statement-breakpoint
ALTER POLICY "templates_view_permission" ON "templates" TO public USING (is_system = true OR (
      organization_id = current_setting('app.current_organization_id')::integer
      AND (
        app_id IS NULL
        OR user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'apps:view',
          organization_id,
          'app',
          app_id
        )
      )
    ));--> statement-breakpoint
ALTER POLICY "templates_create_permission" ON "templates" TO public WITH CHECK (is_system = false
      AND organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'apps:manage',
        organization_id
      ));--> statement-breakpoint
ALTER POLICY "templates_manage_permission" ON "templates" TO public USING (is_system = false
      AND organization_id = current_setting('app.current_organization_id')::integer
      AND (
        created_by = current_setting('app.current_user_id')::uuid
        OR user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'apps:manage',
          organization_id
        )
      ));