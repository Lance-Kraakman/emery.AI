ALTER TABLE "skills" ADD COLUMN "content" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_app_only_user" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "allowed_apps" integer[];--> statement-breakpoint
CREATE POLICY "users_public_app_read" ON "users" AS PERMISSIVE FOR SELECT TO public USING (is_app_only_user = true AND id = current_setting('app.current_user_id', true)::uuid);--> statement-breakpoint
ALTER POLICY "users_manage_permission" ON "users" TO public USING (current_organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'users:manage', 
        current_organization_id
      )) WITH CHECK (current_organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'users:manage',
        current_organization_id
      ));