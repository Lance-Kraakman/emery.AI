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
CREATE POLICY "tasks_agent_assignment_permissions" ON "tasks" AS PERMISSIVE FOR INSERT TO "authenticated" USING (EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = agent_id
      AND a.organization_id = get_current_organization_id()
      AND (
        ) WITH CHECK ( Agent owner can always assign
        a.owner_id = auth.uid()
        OR
        );--> statement-breakpoint
CREATE POLICY "tasks_team_assignment_permissions" ON "tasks" AS PERMISSIVE FOR INSERT TO "authenticated" USING (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_id
      AND t.organization_id = get_current_organization_id()
      AND (
        ) WITH CHECK ( Team member can assign
        EXISTS (
          SELECT 1 FROM team_memberships tm
          WHERE tm.team_id = t.id AND tm.user_id = auth.uid()
        )
        OR
        );--> statement-breakpoint
CREATE POLICY "tasks_routing_permissions" ON "tasks" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((
      ) WITH CHECK ( If routing from agent, check agent's routing permissions
      CASE WHEN routed_from_agent_id IS NOT NULL THEN
        EXISTS (
          SELECT 1 FROM agents source_agent
          WHERE source_agent.id = routed_from_agent_id
          AND source_agent.owner_id = auth.uid()
          AND (
            );