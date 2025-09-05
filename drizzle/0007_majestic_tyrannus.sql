ALTER POLICY "agents_owner_management" ON "agents" TO app_owner USING (organization_id = current_setting('app.current_organization_id')::integer AND EXISTS(
      SELECT 1 FROM users WHERE id = current_setting('app.current_user_id')::uuid 
      AND current_organization_id = agents.organization_id 
      AND organization_role = 'owner'
    )) WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "agents_admin_view" ON "agents" TO app_admin USING (organization_id = current_setting('app.current_organization_id')::integer AND EXISTS(
      SELECT 1 FROM users WHERE id = current_setting('app.current_user_id')::uuid 
      AND current_organization_id = agents.organization_id 
      AND organization_role IN ('admin', 'owner')
    ));--> statement-breakpoint
ALTER POLICY "agents_member_view" ON "agents" TO app_member USING (organization_id = current_setting('app.current_organization_id')::integer AND EXISTS(
      SELECT 1 FROM users WHERE id = current_setting('app.current_user_id')::uuid 
      AND current_organization_id = agents.organization_id
    ));--> statement-breakpoint
ALTER POLICY "agents_owner_control" ON "agents" TO authenticated USING (owner_id = current_setting('app.current_user_id')::uuid AND organization_id = current_setting('app.current_organization_id')::integer) WITH CHECK (owner_id = current_setting('app.current_user_id')::uuid AND organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "chat_messages_tenant_isolation" ON "chat_messages" TO public USING (EXISTS (SELECT 1 FROM chats c WHERE c.id = chat_id AND c.organization_id = current_setting('app.current_organization_id')::integer));--> statement-breakpoint
ALTER POLICY "chats_tenant_isolation" ON "chats" TO public USING (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "databases_tenant_isolation" ON "databases" TO public USING (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "fields_tenant_isolation" ON "fields" TO public USING (EXISTS (SELECT 1 FROM tables t WHERE t.id = table_id AND t.organization_id = current_setting('app.current_organization_id')::integer));--> statement-breakpoint
ALTER POLICY "invitations_tenant_isolation" ON "invitations" TO public USING (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "organizations_member_access" ON "organizations" TO public USING (id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "rag_documents_owner_management" ON "rag_documents" TO app_owner USING (organization_id = current_setting('app.current_organization_id')::integer) WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "rag_documents_admin_management" ON "rag_documents" TO app_admin USING (organization_id = current_setting('app.current_organization_id')::integer) WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "rag_documents_member_view" ON "rag_documents" TO app_member USING (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "rag_indexes_owner_management" ON "rag_indexes" TO app_owner USING (organization_id = current_setting('app.current_organization_id')::integer) WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "rag_indexes_admin_management" ON "rag_indexes" TO app_admin USING (organization_id = current_setting('app.current_organization_id')::integer) WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "rag_indexes_member_view" ON "rag_indexes" TO app_member USING (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "rag_query_logs_owner_management" ON "rag_query_logs" TO app_owner USING (organization_id = current_setting('app.current_organization_id')::integer OR (organization_id IS NULL AND EXISTS (SELECT 1 FROM rag_indexes ri WHERE ri.id = rag_index_id AND ri.organization_id = current_setting('app.current_organization_id')::integer))) WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "rag_query_logs_admin_management" ON "rag_query_logs" TO app_admin USING (organization_id = current_setting('app.current_organization_id')::integer OR (organization_id IS NULL AND EXISTS (SELECT 1 FROM rag_indexes ri WHERE ri.id = rag_index_id AND ri.organization_id = current_setting('app.current_organization_id')::integer))) WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "rag_query_logs_user_access" ON "rag_query_logs" TO app_member,authenticated USING (user_id = current_setting('app.current_user_id')::uuid AND (organization_id = current_setting('app.current_organization_id')::integer OR (organization_id IS NULL AND EXISTS (SELECT 1 FROM rag_indexes ri WHERE ri.id = rag_index_id AND ri.organization_id = current_setting('app.current_organization_id')::integer))));--> statement-breakpoint
ALTER POLICY "tables_tenant_isolation" ON "tables" TO public USING (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "tasks_owner_management" ON "tasks" TO app_owner USING (organization_id = current_setting('app.current_organization_id')::integer) WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "tasks_admin_management" ON "tasks" TO app_admin USING (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "tasks_admin_updates" ON "tasks" TO app_admin USING (organization_id = current_setting('app.current_organization_id')::integer) WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "tasks_member_view" ON "tasks" TO app_member USING (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "tasks_creator_control" ON "tasks" TO authenticated USING (created_by = current_setting('app.current_user_id')::uuid AND organization_id = current_setting('app.current_organization_id')::integer) WITH CHECK (created_by = current_setting('app.current_user_id')::uuid AND organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "tasks_agent_assignment_permissions" ON "tasks" TO authenticated WITH CHECK (EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = agent_id
      AND a.organization_id = current_setting('app.current_organization_id')::integer
      AND (
        a.owner_id = current_setting('app.current_user_id')::uuid
        OR
        (
          COALESCE(a.task_permissions->'assignment'->>'allowOrgAdmins', 'true')::boolean = true
          AND EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = current_setting('app.current_user_id')::uuid
            AND u.organization_role IN ('owner', 'admin')
            AND u.current_organization_id = a.organization_id
          )
        )
        OR
        current_setting('app.current_user_id')::uuid::text = ANY(
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
            WHERE tm1.user_id = current_setting('app.current_user_id')::uuid AND tm2.user_id = a.owner_id
          )
        )
        OR
        EXISTS (
          SELECT 1 FROM agents allowed_agent
          WHERE allowed_agent.owner_id = current_setting('app.current_user_id')::uuid
          AND allowed_agent.id::text = ANY(
            SELECT jsonb_array_elements_text(
              COALESCE(a.task_permissions->'assignment'->'allowedAgents', '[]'::jsonb)
            )
          )
        )
      )
    ));--> statement-breakpoint
ALTER POLICY "tasks_team_assignment_permissions" ON "tasks" TO authenticated WITH CHECK (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_id
      AND t.organization_id = current_setting('app.current_organization_id')::integer
      AND (
        EXISTS (
          SELECT 1 FROM team_memberships tm
          WHERE tm.team_id = t.id AND tm.user_id = current_setting('app.current_user_id')::uuid
        )
        OR
        (
          COALESCE(t.task_permissions->'assignment'->>'allowOrgAdmins', 'true')::boolean = true
          AND EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = current_setting('app.current_user_id')::uuid
            AND u.organization_role IN ('owner', 'admin')
            AND u.current_organization_id = t.organization_id
          )
        )
        OR
        current_setting('app.current_user_id')::uuid::text = ANY(
          SELECT jsonb_array_elements_text(
            COALESCE(t.task_permissions->'assignment'->'allowedUsers', '[]'::jsonb)
          )
        )
      )
    ));--> statement-breakpoint
ALTER POLICY "team_memberships_owner_management" ON "team_memberships" TO app_owner USING (EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.organization_id = current_setting('app.current_organization_id')::integer)) WITH CHECK (EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.organization_id = current_setting('app.current_organization_id')::integer));--> statement-breakpoint
ALTER POLICY "team_memberships_admin_management" ON "team_memberships" TO app_admin USING (EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.organization_id = current_setting('app.current_organization_id')::integer)) WITH CHECK (EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.organization_id = current_setting('app.current_organization_id')::integer));--> statement-breakpoint
ALTER POLICY "team_memberships_member_view" ON "team_memberships" TO app_member USING (user_id = current_setting('app.current_user_id')::uuid OR EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.organization_id = current_setting('app.current_organization_id')::integer));--> statement-breakpoint
ALTER POLICY "teams_owner_management" ON "teams" TO app_owner USING (organization_id = current_setting('app.current_organization_id')::integer) WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "teams_admin_management" ON "teams" TO app_admin USING (organization_id = current_setting('app.current_organization_id')::integer) WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "teams_member_view" ON "teams" TO app_member USING (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "user_organizations_isolation" ON "user_organizations" TO public USING (user_id = current_setting('app.current_user_id')::uuid AND organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "users_owner_management" ON "users" TO app_owner USING (current_organization_id = current_setting('app.current_organization_id')::integer) WITH CHECK (current_organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "users_admin_management" ON "users" TO app_admin USING (current_organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
ALTER POLICY "users_member_self" ON "users" TO app_member USING (id = current_setting('app.current_user_id')::uuid);