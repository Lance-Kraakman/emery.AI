DROP ROLE "app_admin";--> statement-breakpoint
DROP ROLE "app_member";--> statement-breakpoint
DROP ROLE "app_owner";--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_permission" UNIQUE("resource","action")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_role_permission" UNIQUE("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"organization_id" integer,
	"is_system" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" integer NOT NULL,
	"organization_id" integer NOT NULL,
	"assigned_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_user_role_org" UNIQUE("user_id","role_id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "user_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "role_id" integer;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "user_organizations" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "organization_role";--> statement-breakpoint
DROP POLICY "agents_owner_management" ON "agents" CASCADE;--> statement-breakpoint
DROP POLICY "agents_admin_view" ON "agents" CASCADE;--> statement-breakpoint
DROP POLICY "agents_member_view" ON "agents" CASCADE;--> statement-breakpoint
DROP POLICY "agents_owner_control" ON "agents" CASCADE;--> statement-breakpoint
DROP POLICY "organizations_member_access" ON "organizations" CASCADE;--> statement-breakpoint
DROP POLICY "organizations_owner_access" ON "organizations" CASCADE;--> statement-breakpoint
DROP POLICY "organizations_admin_access" ON "organizations" CASCADE;--> statement-breakpoint
DROP POLICY "rag_documents_owner_management" ON "rag_documents" CASCADE;--> statement-breakpoint
DROP POLICY "rag_documents_admin_management" ON "rag_documents" CASCADE;--> statement-breakpoint
DROP POLICY "rag_documents_member_view" ON "rag_documents" CASCADE;--> statement-breakpoint
DROP POLICY "rag_indexes_owner_management" ON "rag_indexes" CASCADE;--> statement-breakpoint
DROP POLICY "rag_indexes_admin_management" ON "rag_indexes" CASCADE;--> statement-breakpoint
DROP POLICY "rag_indexes_member_view" ON "rag_indexes" CASCADE;--> statement-breakpoint
DROP POLICY "rag_query_logs_owner_management" ON "rag_query_logs" CASCADE;--> statement-breakpoint
DROP POLICY "rag_query_logs_admin_management" ON "rag_query_logs" CASCADE;--> statement-breakpoint
DROP POLICY "rag_query_logs_user_access" ON "rag_query_logs" CASCADE;--> statement-breakpoint
DROP POLICY "tasks_owner_management" ON "tasks" CASCADE;--> statement-breakpoint
DROP POLICY "tasks_admin_management" ON "tasks" CASCADE;--> statement-breakpoint
DROP POLICY "tasks_admin_updates" ON "tasks" CASCADE;--> statement-breakpoint
DROP POLICY "tasks_member_view" ON "tasks" CASCADE;--> statement-breakpoint
DROP POLICY "team_memberships_owner_management" ON "team_memberships" CASCADE;--> statement-breakpoint
DROP POLICY "team_memberships_admin_management" ON "team_memberships" CASCADE;--> statement-breakpoint
DROP POLICY "team_memberships_member_view" ON "team_memberships" CASCADE;--> statement-breakpoint
DROP POLICY "teams_owner_management" ON "teams" CASCADE;--> statement-breakpoint
DROP POLICY "teams_admin_management" ON "teams" CASCADE;--> statement-breakpoint
DROP POLICY "teams_member_view" ON "teams" CASCADE;--> statement-breakpoint
DROP POLICY "users_owner_management" ON "users" CASCADE;--> statement-breakpoint
DROP POLICY "users_admin_management" ON "users" CASCADE;--> statement-breakpoint
DROP POLICY "users_member_self" ON "users" CASCADE;--> statement-breakpoint
CREATE POLICY "agents_view_permission" ON "agents" AS PERMISSIVE FOR SELECT TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND (
        owner_id = current_setting('app.current_user_id')::uuid
        OR user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'agents:view',
          organization_id
        )
      ));--> statement-breakpoint
CREATE POLICY "agents_manage_permission" ON "agents" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND (
        owner_id = current_setting('app.current_user_id')::uuid
        OR user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'agents:manage',
          organization_id
        )
      )) WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer
      AND (
        owner_id = current_setting('app.current_user_id')::uuid
        OR user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'agents:manage',
          organization_id
        )
      ));--> statement-breakpoint
CREATE POLICY "agents_create_permission" ON "agents" AS PERMISSIVE FOR INSERT TO public WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'agents:create',
        organization_id
      ));--> statement-breakpoint
CREATE POLICY "agents_execute_permission" ON "agents" AS PERMISSIVE FOR SELECT TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND (
        owner_id = current_setting('app.current_user_id')::uuid
        OR user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'agents:execute',
          organization_id
        )
      ));--> statement-breakpoint
CREATE POLICY "organizations_view_permission" ON "organizations" AS PERMISSIVE FOR SELECT TO public USING (id = current_setting('app.current_organization_id')::integer 
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'organizations:view',
        id
      ));--> statement-breakpoint
CREATE POLICY "organizations_manage_permission" ON "organizations" AS PERMISSIVE FOR UPDATE TO public USING (user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'organizations:manage',
      id
    )) WITH CHECK (user_has_permission(
      current_setting('app.current_user_id')::uuid,
      'organizations:manage',
      id
    ));--> statement-breakpoint
CREATE POLICY "rag_documents_manage_permission" ON "rag_documents" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:manage',
        organization_id
      )) WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:manage',
        organization_id
      ));--> statement-breakpoint
CREATE POLICY "rag_documents_view_permission" ON "rag_documents" AS PERMISSIVE FOR SELECT TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:view',
        organization_id
      ));--> statement-breakpoint
CREATE POLICY "rag_indexes_manage_permission" ON "rag_indexes" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:manage',
        organization_id
      )) WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:manage',
        organization_id
      ));--> statement-breakpoint
CREATE POLICY "rag_indexes_view_permission" ON "rag_indexes" AS PERMISSIVE FOR SELECT TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:view',
        organization_id
      ));--> statement-breakpoint
CREATE POLICY "rag_query_logs_manage_permission" ON "rag_query_logs" AS PERMISSIVE FOR ALL TO public USING ((organization_id = current_setting('app.current_organization_id')::integer OR (organization_id IS NULL AND EXISTS (SELECT 1 FROM rag_indexes ri WHERE ri.id = rag_index_id AND ri.organization_id = current_setting('app.current_organization_id')::integer)))
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:manage',
        COALESCE(organization_id, (SELECT ri.organization_id FROM rag_indexes ri WHERE ri.id = rag_index_id))
      )) WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:manage',
        organization_id
      ));--> statement-breakpoint
CREATE POLICY "rag_query_logs_view_permission" ON "rag_query_logs" AS PERMISSIVE FOR SELECT TO public USING ((user_id = current_setting('app.current_user_id')::uuid OR user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'data:view',
        COALESCE(organization_id, (SELECT ri.organization_id FROM rag_indexes ri WHERE ri.id = rag_index_id))
      ))
      AND (organization_id = current_setting('app.current_organization_id')::integer OR (organization_id IS NULL AND EXISTS (SELECT 1 FROM rag_indexes ri WHERE ri.id = rag_index_id AND ri.organization_id = current_setting('app.current_organization_id')::integer))));--> statement-breakpoint
CREATE POLICY "tasks_view_permission" ON "tasks" AS PERMISSIVE FOR SELECT TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'tasks:view',
        organization_id
      ));--> statement-breakpoint
CREATE POLICY "tasks_manage_permission" ON "tasks" AS PERMISSIVE FOR UPDATE TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'tasks:manage',
        organization_id
      )) WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'tasks:manage',
        organization_id
      ));--> statement-breakpoint
CREATE POLICY "team_memberships_view_permission" ON "team_memberships" AS PERMISSIVE FOR SELECT TO public USING (user_id = current_setting('app.current_user_id')::uuid 
      OR EXISTS (
        SELECT 1 FROM teams t 
        WHERE t.id = team_id 
        AND t.organization_id = current_setting('app.current_organization_id')::integer
        AND user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'teams:view',
          t.organization_id
        )
      ));--> statement-breakpoint
CREATE POLICY "team_memberships_manage_permission" ON "team_memberships" AS PERMISSIVE FOR ALL TO public USING (EXISTS (
      SELECT 1 FROM teams t 
      WHERE t.id = team_id 
      AND t.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'teams:manage',
        t.organization_id
      )
    )) WITH CHECK (EXISTS (
      SELECT 1 FROM teams t 
      WHERE t.id = team_id 
      AND t.organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'teams:manage',
        t.organization_id
      )
    ));--> statement-breakpoint
CREATE POLICY "teams_view_permission" ON "teams" AS PERMISSIVE FOR SELECT TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'teams:view',
        organization_id
      ));--> statement-breakpoint
CREATE POLICY "teams_manage_permission" ON "teams" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'teams:manage',
        organization_id
      )) WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'teams:manage',
        organization_id
      ));--> statement-breakpoint
CREATE POLICY "teams_create_permission" ON "teams" AS PERMISSIVE FOR INSERT TO public WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'teams:create',
        organization_id
      ));--> statement-breakpoint
CREATE POLICY "users_view_permission" ON "users" AS PERMISSIVE FOR SELECT TO public USING (current_organization_id = current_setting('app.current_organization_id')::integer 
      AND (
        id = current_setting('app.current_user_id')::uuid 
        OR user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'users:view',
          current_organization_id
        )
      ));--> statement-breakpoint
CREATE POLICY "users_manage_permission" ON "users" AS PERMISSIVE FOR UPDATE TO public USING (current_organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'users:manage', 
        current_organization_id
      )) WITH CHECK (current_organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'users:manage', 
        current_organization_id
      ));--> statement-breakpoint
CREATE POLICY "roles_tenant_isolation" ON "roles" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer OR is_system = true);--> statement-breakpoint
CREATE POLICY "user_roles_tenant_isolation" ON "user_roles" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer);