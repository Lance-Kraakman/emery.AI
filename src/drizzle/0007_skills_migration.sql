-- Skills Migration (renamed from capabilities)
-- Creates skills and skill_steps tables, renames capability_name to skill_name in tasks

CREATE TABLE "skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "skills" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "skill_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"skill_id" integer NOT NULL,
	"step_order" integer NOT NULL,
	"type" text NOT NULL,
	"instructions" text NOT NULL,
	"model" text,
	"tools" jsonb DEFAULT '[]' NOT NULL,
	"servers" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "skill_steps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tasks" RENAME COLUMN "capability_name" TO "skill_name";--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_steps" ADD CONSTRAINT "skill_steps_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "skills_view_permission" ON "skills" AS PERMISSIVE FOR SELECT TO public USING (EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = agent_id
      AND a.organization_id = current_setting('app.current_organization_id')::integer
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
    ));--> statement-breakpoint
CREATE POLICY "skills_manage_permission" ON "skills" AS PERMISSIVE FOR ALL TO public USING (EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = agent_id
      AND a.organization_id = current_setting('app.current_organization_id')::integer
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
    )) WITH CHECK (EXISTS (
      SELECT 1 FROM agents a
      WHERE a.id = agent_id
      AND a.organization_id = current_setting('app.current_organization_id')::integer
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
    ));--> statement-breakpoint
CREATE POLICY "skill_steps_view_permission" ON "skill_steps" AS PERMISSIVE FOR SELECT TO public USING (EXISTS (
      SELECT 1 FROM skills s
      JOIN agents a ON a.id = s.agent_id
      WHERE s.id = skill_id
      AND a.organization_id = current_setting('app.current_organization_id')::integer
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
    ));--> statement-breakpoint
CREATE POLICY "skill_steps_manage_permission" ON "skill_steps" AS PERMISSIVE FOR ALL TO public USING (EXISTS (
      SELECT 1 FROM skills s
      JOIN agents a ON a.id = s.agent_id
      WHERE s.id = skill_id
      AND a.organization_id = current_setting('app.current_organization_id')::integer
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
    )) WITH CHECK (EXISTS (
      SELECT 1 FROM skills s
      JOIN agents a ON a.id = s.agent_id
      WHERE s.id = skill_id
      AND a.organization_id = current_setting('app.current_organization_id')::integer
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
    ));
