CREATE TABLE "capabilities" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "capabilities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "capability_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"capability_id" integer NOT NULL,
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
ALTER TABLE "capability_steps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "capabilities" ADD CONSTRAINT "capabilities_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capability_steps" ADD CONSTRAINT "capability_steps_capability_id_capabilities_id_fk" FOREIGN KEY ("capability_id") REFERENCES "public"."capabilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "capabilities_view_permission" ON "capabilities" AS PERMISSIVE FOR SELECT TO public USING (EXISTS (
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
CREATE POLICY "capabilities_manage_permission" ON "capabilities" AS PERMISSIVE FOR ALL TO public USING (EXISTS (
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
CREATE POLICY "capability_steps_view_permission" ON "capability_steps" AS PERMISSIVE FOR SELECT TO public USING (EXISTS (
      SELECT 1 FROM capabilities c
      JOIN agents a ON a.id = c.agent_id
      WHERE c.id = capability_id
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
CREATE POLICY "capability_steps_manage_permission" ON "capability_steps" AS PERMISSIVE FOR ALL TO public USING (EXISTS (
      SELECT 1 FROM capabilities c
      JOIN agents a ON a.id = c.agent_id
      WHERE c.id = capability_id
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
      SELECT 1 FROM capabilities c
      JOIN agents a ON a.id = c.agent_id
      WHERE c.id = capability_id
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