ALTER POLICY "tasks_agent_assignment_permissions" ON "tasks" TO authenticated USING (EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = agent_id
      AND a.organization_id = get_current_organization_id()
      AND (
        a.owner_id = auth.uid()
        OR
        (
          COALESCE(a.task_permissions->'assignment'->>'allowOrgAdmins', 'true')::boolean = true
          AND EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.organization_role IN ('owner', 'admin')
            AND u.current_organization_id = a.organization_id
          )
        )
        OR
        auth.uid()::text = ANY(
          SELECT jsonb_array_elements_text(
            COALESCE(a.task_permissions->'assignment'->'allowedUsers', '[]'::jsonb)
          )
        )
        OR
        (
          COALESCE(a.task_permissions->'assignment'->>'allowTeamMembers', 'false')::boolean = true
          AND EXISTS (
            SELECT 1 FROM team_memberships tm1
            JOIN team_memberships tm2 ON tm1.team_id = tm2.team_id
            WHERE tm1.user_id = auth.uid() AND tm2.user_id = a.owner_id
          )
        )
        OR
        (
          COALESCE(a.task_permissions->'assignment'->>'allowOrgMembers', 'false')::boolean = true
          AND EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.current_organization_id = a.organization_id
          )
        )
        OR
        EXISTS (
          SELECT 1 FROM agents allowed_agent
          WHERE allowed_agent.owner_id = auth.uid()
          AND allowed_agent.id::text = ANY(
            SELECT jsonb_array_elements_text(
              COALESCE(a.task_permissions->'assignment'->'allowedAgents', '[]'::jsonb)
            )
          )
        )
        OR
        EXISTS (
          SELECT 1 FROM team_memberships tm
          JOIN teams t ON t.id = tm.team_id
          WHERE tm.user_id = auth.uid()
          AND t.id::text = ANY(
            SELECT jsonb_array_elements_text(
              COALESCE(a.task_permissions->'assignment'->'allowedTeams', '[]'::jsonb)
            )
          )
        )
      )
    )) WITH CHECK  ( Agent owner can always assign
        a.owner_id = auth.uid()
        OR
        );--> statement-breakpoint
ALTER POLICY "tasks_team_assignment_permissions" ON "tasks" TO authenticated USING (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_id
      AND t.organization_id = get_current_organization_id()
      AND (
        EXISTS (
          SELECT 1 FROM team_memberships tm
          WHERE tm.team_id = t.id AND tm.user_id = auth.uid()
        )
        OR
        (
          COALESCE(t.task_permissions->'assignment'->>'allowOrgAdmins', 'true')::boolean = true
          AND EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.organization_role IN ('owner', 'admin')
            AND u.current_organization_id = t.organization_id
          )
        )
        OR
        auth.uid()::text = ANY(
          SELECT jsonb_array_elements_text(
            COALESCE(t.task_permissions->'assignment'->'allowedUsers', '[]'::jsonb)
          )
        )
        OR
        EXISTS (
          SELECT 1 FROM agents allowed_agent
          WHERE allowed_agent.owner_id = auth.uid()
          AND allowed_agent.id::text = ANY(
            SELECT jsonb_array_elements_text(
              COALESCE(t.task_permissions->'assignment'->'allowedAgents', '[]'::jsonb)
            )
          )
        )
        OR
        EXISTS (
          SELECT 1 FROM team_memberships tm
          JOIN teams allowed_team ON allowed_team.id = tm.team_id
          WHERE tm.user_id = auth.uid()
          AND allowed_team.id::text = ANY(
            SELECT jsonb_array_elements_text(
              COALESCE(t.task_permissions->'assignment'->'allowedTeams', '[]'::jsonb)
            )
          )
        )
        OR
        (
          COALESCE(t.task_permissions->'assignment'->>'allowTeamMembers', 'false')::boolean = true
          AND EXISTS (
            SELECT 1 FROM team_memberships tm
            WHERE tm.team_id = t.id AND tm.user_id = auth.uid()
          )
        )
        OR
        (
          COALESCE(t.task_permissions->'assignment'->>'allowOrgMembers', 'false')::boolean = true
          AND EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
            AND u.current_organization_id = t.organization_id
          )
        )
      )
    )) WITH CHECK  ( Team member can assign
        EXISTS (
          SELECT 1 FROM team_memberships tm
          WHERE tm.team_id = t.id AND tm.user_id = auth.uid()
        )
        OR
        );--> statement-breakpoint
ALTER POLICY "tasks_routing_permissions" ON "tasks" TO authenticated USING ((
      CASE WHEN routed_from_agent_id IS NOT NULL THEN
        EXISTS (
          SELECT 1 FROM agents source_agent
          WHERE source_agent.id = routed_from_agent_id
          AND source_agent.owner_id = auth.uid()
          AND (
            (agent_id IS NOT NULL AND agent_id::text = ANY(
              SELECT jsonb_array_elements_text(
                COALESCE(source_agent.task_permissions->'routing'->'allowedAgents', '[]'::jsonb)
              )
            ))
            OR
            (team_id IS NOT NULL AND team_id::text = ANY(
              SELECT jsonb_array_elements_text(
                COALESCE(source_agent.task_permissions->'routing'->'allowedTeams', '[]'::jsonb)
              )
            ))
            OR
            (
              agent_id IS NOT NULL 
              AND COALESCE(source_agent.task_permissions->'routing'->>'allowAnyTeamAgent', 'true')::boolean = true
              AND EXISTS (
                SELECT 1 FROM team_memberships tm1
                JOIN team_memberships tm2 ON tm1.team_id = tm2.team_id
                JOIN agents target_agent ON target_agent.id = agent_id
                WHERE tm1.user_id = source_agent.owner_id AND tm2.user_id = target_agent.owner_id
              )
            )
            OR
            (
              agent_id IS NOT NULL
              AND COALESCE(source_agent.task_permissions->'routing'->>'allowAnyOrgAgent', 'false')::boolean = true
              AND EXISTS (
                SELECT 1 FROM agents target_agent
                WHERE target_agent.id = agent_id
                AND target_agent.organization_id = source_agent.organization_id
              )
            )
            OR
            (
              COALESCE(source_agent.task_permissions->'routing'->>'allowCrossTeamRouting', 'false')::boolean = true
            )
          )
        )
      WHEN routed_from_team_id IS NOT NULL THEN
        EXISTS (
          SELECT 1 FROM teams source_team
          WHERE source_team.id = routed_from_team_id
          AND EXISTS (
            SELECT 1 FROM team_memberships tm
            WHERE tm.team_id = source_team.id AND tm.user_id = auth.uid()
          )
          AND (
            (agent_id IS NOT NULL AND agent_id::text = ANY(
              SELECT jsonb_array_elements_text(
                COALESCE(source_team.task_permissions->'routing'->'allowedAgents', '[]'::jsonb)
              )
            ))
            OR
            (team_id IS NOT NULL AND team_id::text = ANY(
              SELECT jsonb_array_elements_text(
                COALESCE(source_team.task_permissions->'routing'->'allowedTeams', '[]'::jsonb)
              )
            ))
            OR
            (
              agent_id IS NOT NULL
              AND COALESCE(source_team.task_permissions->'routing'->>'allowAnyOrgAgent', 'false')::boolean = true
            )
            OR
            (
              COALESCE(source_team.task_permissions->'routing'->>'allowCrossTeamRouting', 'false')::boolean = true
            )
          )
        )
      ELSE true
      END
    )) WITH CHECK  ( If routing from agent, check agent's routing permissions
      CASE WHEN routed_from_agent_id IS NOT NULL THEN
        EXISTS (
          SELECT 1 FROM agents source_agent
          WHERE source_agent.id = routed_from_agent_id
          AND source_agent.owner_id = auth.uid()
          AND (
            );