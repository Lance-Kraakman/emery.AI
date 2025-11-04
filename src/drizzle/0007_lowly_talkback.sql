CREATE TABLE "skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"inputs" jsonb DEFAULT '[]'::jsonb,
	"outputs" jsonb DEFAULT '[]'::jsonb,
	"instructions" text DEFAULT '' NOT NULL,
	"tools" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "skills" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "skill_name" text;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "capability_name";--> statement-breakpoint
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
    ));