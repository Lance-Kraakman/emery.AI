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
          'organization',
          organization_id
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
          'organization',
          organization_id
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
          'organization',
          organization_id
        ))
      )
    );