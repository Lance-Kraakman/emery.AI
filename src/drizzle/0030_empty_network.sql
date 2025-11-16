ALTER TABLE "apps" DROP CONSTRAINT "apps_home_page_id_pages_id_fk";
--> statement-breakpoint
ALTER TABLE "apps" DROP CONSTRAINT "apps_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "databases" DROP CONSTRAINT "databases_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "pages" DROP CONSTRAINT "pages_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tables" DROP CONSTRAINT "tables_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "apps" ADD COLUMN "owner_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "databases" ADD COLUMN "owner_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "owner_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "owner_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "owner_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "views" ADD COLUMN "owner_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "apps" ADD CONSTRAINT "apps_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "databases" ADD CONSTRAINT "databases_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "views" ADD CONSTRAINT "views_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apps" DROP COLUMN "created_by";--> statement-breakpoint
ALTER TABLE "databases" DROP COLUMN "created_by";--> statement-breakpoint
ALTER TABLE "pages" DROP COLUMN "created_by";--> statement-breakpoint
ALTER TABLE "tables" DROP COLUMN "created_by";--> statement-breakpoint
CREATE POLICY "databases_view_permission" ON "databases" AS PERMISSIVE FOR SELECT TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:view',
        organization_id,
        'database',
        id
      ));--> statement-breakpoint
CREATE POLICY "databases_manage_permission" ON "databases" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:manage',
        organization_id,
        'database',
        id
      ));--> statement-breakpoint
CREATE POLICY "fields_view_permission" ON "fields" AS PERMISSIVE FOR SELECT TO public USING (EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_id
      AND t.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:view',
        t.organization_id,
        'table',
        t.id
      )
    ));--> statement-breakpoint
CREATE POLICY "fields_manage_permission" ON "fields" AS PERMISSIVE FOR ALL TO public USING (EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_id
      AND t.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:manage',
        t.organization_id,
        'table',
        t.id
      )
    ));--> statement-breakpoint
CREATE POLICY "tables_view_permission" ON "tables" AS PERMISSIVE FOR SELECT TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:view',
        organization_id,
        'table',
        id
      ));--> statement-breakpoint
CREATE POLICY "tables_manage_permission" ON "tables" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:manage',
        organization_id,
        'table',
        id
      ));--> statement-breakpoint
ALTER POLICY "apps_view_permission" ON "apps" TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'apps:view',
        current_setting('app.current_organization_id')::integer,
        'app',
        id
      ));--> statement-breakpoint
ALTER POLICY "apps_manage_permission" ON "apps" TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'apps:manage',
        current_setting('app.current_organization_id')::integer,
        'app',
        id
      ));--> statement-breakpoint
ALTER POLICY "pages_view_permission" ON "pages" TO public USING (EXISTS (
      SELECT 1 FROM apps a
      WHERE a.id = app_id
      AND a.organization_id = current_setting('app.current_organization_id')::integer
    )
    AND user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'apps:view',
      current_setting('app.current_organization_id')::integer,
      'page',
      id
    ));--> statement-breakpoint
ALTER POLICY "pages_manage_permission" ON "pages" TO public USING (EXISTS (
      SELECT 1 FROM apps a
      WHERE a.id = app_id
      AND a.organization_id = current_setting('app.current_organization_id')::integer
    )
    AND user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'apps:manage',
      current_setting('app.current_organization_id')::integer,
      'page',
      id
    ));--> statement-breakpoint
ALTER POLICY "pages_publish_permission" ON "pages" TO public USING (EXISTS (
      SELECT 1 FROM apps a
      WHERE a.id = app_id
      AND a.organization_id = current_setting('app.current_organization_id')::integer
    )
    AND user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'apps:publish',
      current_setting('app.current_organization_id')::integer,
      'page',
      id
    ));--> statement-breakpoint
ALTER POLICY "skills_view_permission" ON "skills" TO public USING (
      organization_id = current_setting('app.current_organization_id')::integer
      AND (
        (agent_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM agents a
          WHERE a.id = agent_id
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
        (agent_id IS NULL AND user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'skills:view',
          organization_id,
          'skill',
          id
        ))
      )
    );--> statement-breakpoint
ALTER POLICY "skills_manage_permission" ON "skills" TO public USING (
      organization_id = current_setting('app.current_organization_id')::integer
      AND (
        (agent_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM agents a
          WHERE a.id = agent_id
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
        (agent_id IS NULL AND user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'skills:manage',
          organization_id,
          'skill',
          id
        ))
      )
    ) WITH CHECK (
      organization_id = current_setting('app.current_organization_id')::integer
      AND (
        (agent_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM agents a
          WHERE a.id = agent_id
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
        (agent_id IS NULL AND user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'skills:manage',
          organization_id,
          'skill',
          id
        ))
      )
    );--> statement-breakpoint
ALTER POLICY "views_view_permission" ON "views" TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:view',
        organization_id,
        'view',
        id
      ));--> statement-breakpoint
ALTER POLICY "views_manage_permission" ON "views" TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:manage',
        organization_id,
        'view',
        id
      )) WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:manage',
        organization_id,
        'view',
        id
      ));