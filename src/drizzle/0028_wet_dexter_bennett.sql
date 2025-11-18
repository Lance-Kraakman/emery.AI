ALTER TABLE "pages" RENAME COLUMN "is_published" TO "is_public";--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "requires_auth" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "allowed_roles" text[];--> statement-breakpoint
CREATE POLICY "pages_authenticated_read" ON "pages" AS PERMISSIVE FOR SELECT TO public USING (
      is_public = true
      AND requires_auth = true
      AND current_setting('app.current_user_id', true)::uuid IS NOT NULL
      AND (
        allowed_roles IS NULL
        OR allowed_roles = '{}'
        OR EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = current_setting('app.current_user_id', true)::uuid
          AND r.name = ANY(allowed_roles)
        )
      )
    );--> statement-breakpoint
ALTER POLICY "apps_public_read" ON "apps" TO public USING (EXISTS (
      SELECT 1 FROM pages p
      WHERE p.app_id = id
      AND p.is_public = true
    ));--> statement-breakpoint
ALTER POLICY "pages_public_read" ON "pages" TO public USING (is_public = true AND requires_auth = false);