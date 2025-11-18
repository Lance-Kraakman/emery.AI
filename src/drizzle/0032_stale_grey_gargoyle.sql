ALTER POLICY "databases_view_permission" ON "databases" TO public USING (organization_id = current_setting('app.current_organization_id')::integer
    AND user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'view:manage',
      organization_id,
      'view',
      id
    ));--> statement-breakpoint
ALTER POLICY "databases_manage_permission" ON "databases" TO public USING (organization_id = current_setting('app.current_organization_id')::integer
    AND user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'database:manage',
      organization_id,
      'database',
      id
    ));--> statement-breakpoint
ALTER POLICY "fields_view_permission" ON "fields" TO public USING (EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_id
      AND t.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'table:view',
        t.organization_id,
        'table',
        t.id
      )
    ));--> statement-breakpoint
ALTER POLICY "fields_manage_permission" ON "fields" TO public USING (EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_id
      AND t.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'table:manage',
        t.organization_id,
        'table',
        t.id
      )
    ));--> statement-breakpoint
ALTER POLICY "pages_view_permission" ON "pages" TO public USING (EXISTS (
      SELECT 1 FROM apps a
      WHERE a.id = app_id
      AND a.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'apps:view',
        a.organization_id,
        'app',
        a.id
      )
    )
    AND user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'page:view',
      (SELECT organization_id FROM apps WHERE apps.id = app_id),
      'page',
      id
    ));--> statement-breakpoint
ALTER POLICY "pages_manage_permission" ON "pages" TO public USING (EXISTS (
      SELECT 1 FROM apps a
      WHERE a.id = app_id
      AND a.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'apps:manage',
        a.organization_id,
        'app',
        a.id
      )
    )
    AND user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'page:manage',
      (SELECT organization_id FROM apps WHERE apps.id = app_id),
      'page',
      id
    ));--> statement-breakpoint
ALTER POLICY "pages_publish_permission" ON "pages" TO public USING (EXISTS (
      SELECT 1 FROM apps a
      WHERE a.id = app_id
      AND a.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'apps:publish',
        a.organization_id,
        'app',
        a.id
      )
    )
    AND user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'page:publish',
      (SELECT organization_id FROM apps WHERE apps.id = app_id),
      'page',
      id
    ));--> statement-breakpoint
ALTER POLICY "tables_view_permission" ON "tables" TO public USING (EXISTS (
      SELECT 1 FROM databases d
      WHERE d.id = database_id
      AND d.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'database:view',
        d.organization_id,
        'database',
        d.id
      )
    )
    AND user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'table:view',
      (SELECT organization_id FROM databases WHERE databases.id = database_id),
      'table',
      id
    ));--> statement-breakpoint
ALTER POLICY "tables_manage_permission" ON "tables" TO public USING (EXISTS (
      SELECT 1 FROM databases d
      WHERE d.id = database_id
      AND d.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'database:manage',
        d.organization_id,
        'database',
        d.id
      )
    )
    AND user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'table:manage',
      (SELECT organization_id FROM databases WHERE databases.id = database_id),
      'table',
      id
    ));--> statement-breakpoint
ALTER POLICY "views_view_permission" ON "views" TO public USING (EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_id
      AND t.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'table:view',
        t.organization_id,
        'table',
        t.id
      )
    )
    AND user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'view:view',
      (SELECT organization_id FROM tables WHERE tables.id = table_id),
      'view',
      id
    ));--> statement-breakpoint
ALTER POLICY "views_create_permission" ON "views" TO public WITH CHECK (EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_id
      AND t.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'table:manage',
        t.organization_id,
        'table',
        t.id
      )
    )
    AND user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'view:create',
      (SELECT organization_id FROM tables WHERE tables.id = table_id),
      'view',
      id
    ));--> statement-breakpoint
ALTER POLICY "views_manage_permission" ON "views" TO public USING (EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_id
      AND t.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'table:manage',
        t.organization_id,
        'table',
        t.id
      )
    )
    AND user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'view:manage',
      organization_id,
      'view',
      id
    )) WITH CHECK (EXISTS (
      SELECT 1 FROM tables t
      WHERE t.id = table_id
      AND t.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'table:manage',
        t.organization_id,
        'table',
        t.id
      )
    )
    AND user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'view:manage',
      organization_id,
      'view',
      id
    ));