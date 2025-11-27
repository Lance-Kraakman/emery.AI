CREATE TABLE "credential_delegations" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"agent_id" integer NOT NULL,
	"services" text[] NOT NULL,
	"status" text DEFAULT 'approved' NOT NULL,
	"approved_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_owner_agent_delegation" UNIQUE("owner_id","agent_id")
);
--> statement-breakpoint
ALTER TABLE "credential_delegations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "credential_delegations" ADD CONSTRAINT "credential_delegations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credential_delegations" ADD CONSTRAINT "credential_delegations_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delegations_agent_idx" ON "credential_delegations" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "delegations_owner_idx" ON "credential_delegations" USING btree ("owner_id");--> statement-breakpoint
CREATE POLICY "delegations_view_permission" ON "credential_delegations" AS PERMISSIVE FOR SELECT TO public USING (
      owner_id = current_setting('app.current_user_id')::uuid
      OR EXISTS (
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
      )
    );--> statement-breakpoint
CREATE POLICY "delegations_create_permission" ON "credential_delegations" AS PERMISSIVE FOR INSERT TO public WITH CHECK (owner_id = current_setting('app.current_user_id')::uuid);--> statement-breakpoint
CREATE POLICY "delegations_manage_permission" ON "credential_delegations" AS PERMISSIVE FOR ALL TO public USING (owner_id = current_setting('app.current_user_id')::uuid) WITH CHECK (owner_id = current_setting('app.current_user_id')::uuid);