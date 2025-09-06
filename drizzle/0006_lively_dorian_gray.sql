ALTER TABLE "agents" ADD COLUMN "task_permissions" jsonb DEFAULT '{"assignment": {"allowOrgAdmins": true}, "routing": {"allowAnyTeamAgent": true}}';--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "team_id" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "routed_from_agent_id" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "routed_from_team_id" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "routed_at" timestamp;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "routing_reason" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "task_permissions" jsonb DEFAULT '{"assignment": {"allowOrgAdmins": true}, "routing": {"allowCrossTeamRouting": false}}';--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_routed_from_agent_id_agents_id_fk" FOREIGN KEY ("routed_from_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_routed_from_team_id_teams_id_fk" FOREIGN KEY ("routed_from_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "tasks_agent_assignment_permissions" ON "tasks" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (
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
CREATE POLICY "tasks_team_assignment_permissions" ON "tasks" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (team_id IS NOT NULL AND EXISTS (
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
    ));