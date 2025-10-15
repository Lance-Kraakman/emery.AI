CREATE ROLE "anon" WITH NOINHERIT;--> statement-breakpoint
CREATE ROLE "authenticated";--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"description" text,
	"persona" text,
	"owner_id" uuid NOT NULL,
	"tools" jsonb,
	"servers" jsonb,
	"trigger" jsonb,
	"capabilities" jsonb,
	"database_id" text,
	"status" text DEFAULT 'active',
	"organization_id" integer NOT NULL,
	"api_key" text,
	"last_used_at" timestamp,
	"agent_type" text DEFAULT 'general',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "agents_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
ALTER TABLE "agents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"message_index" integer NOT NULL,
	"parent_message_id" uuid,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" integer NOT NULL,
	"created_by" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"context_metadata" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"message_count" integer DEFAULT 0,
	"last_message_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "chats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "databases" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"metadata" jsonb,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "databases_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "databases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"table_id" integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" text NOT NULL,
	"order_index" integer DEFAULT 0,
	"required" boolean DEFAULT false,
	"field_config" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "fields" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"invited_by" uuid NOT NULL,
	"email" text NOT NULL,
	"role_id" integer,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"mission" text,
	"shared_tools" text[],
	"shared_servers" text[],
	"database_id" text,
	"view_config" jsonb,
	"plan" text DEFAULT 'free',
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"stripe_subscription_status" text,
	"analysis_capabilities" jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_permission" UNIQUE("resource","action")
);
--> statement-breakpoint
CREATE TABLE "rag_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rag_index_id" uuid NOT NULL,
	"organization_id" integer NOT NULL,
	"domain_type" text NOT NULL,
	"source_id" text NOT NULL,
	"source_name" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"embedding" vector(768),
	"content_hash" text NOT NULL,
	"indexed_at" timestamp DEFAULT now(),
	"source_updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "rag_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rag_indexes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"organization_id" integer NOT NULL,
	"agent_id" integer,
	"domain_types" jsonb NOT NULL,
	"domain_filters" jsonb,
	"embedding_model" text DEFAULT 'sentence-transformers/all-mpnet-base-v2',
	"embedding_dimensions" integer DEFAULT 768,
	"status" text DEFAULT 'active',
	"last_indexed_at" timestamp,
	"document_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "rag_indexes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rag_query_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rag_index_id" uuid NOT NULL,
	"organization_id" integer,
	"query" text NOT NULL,
	"query_embedding" vector(768),
	"results_count" integer NOT NULL,
	"top_results" jsonb,
	"user_id" uuid,
	"agent_id" integer,
	"session_id" text,
	"similarity_metric" text,
	"threshold" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "rag_query_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL,
	"resource_type" text,
	"resource_id" integer,
	"resource_scope" text DEFAULT 'all',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_role_permission_resource" UNIQUE("role_id","permission_id","resource_type","resource_id")
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
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tables" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"database_id" integer NOT NULL,
	"organization_id" integer NOT NULL,
	"name" text NOT NULL,
	"s3_path" text NOT NULL,
	"metadata" jsonb,
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tables_s3_path_unique" UNIQUE("s3_path")
);
--> statement-breakpoint
ALTER TABLE "tables" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" integer NOT NULL,
	"organization_id" integer NOT NULL,
	"name" text NOT NULL,
	"capability_name" text,
	"instructions" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"error" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_by" uuid,
	"team_id" integer,
	"routed_from_agent_id" integer,
	"routed_from_team_id" integer,
	"routed_at" timestamp,
	"routing_reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "team_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "team_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"organization_id" integer NOT NULL,
	"name" text NOT NULL,
	"purpose" text,
	"description" text,
	"responsibilities" text[],
	"goals" text[],
	"agent_ids" text[],
	"database_id" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "user_organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
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
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp,
	"image" text,
	"current_organization_id" integer,
	"job_title" text,
	"teams" text[],
	"api_key" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_parent_message_id_chat_messages_id_fk" FOREIGN KEY ("parent_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "databases" ADD CONSTRAINT "databases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "databases" ADD CONSTRAINT "databases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_rag_index_id_rag_indexes_id_fk" FOREIGN KEY ("rag_index_id") REFERENCES "public"."rag_indexes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_indexes" ADD CONSTRAINT "rag_indexes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_indexes" ADD CONSTRAINT "rag_indexes_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_query_logs" ADD CONSTRAINT "rag_query_logs_rag_index_id_rag_indexes_id_fk" FOREIGN KEY ("rag_index_id") REFERENCES "public"."rag_indexes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_query_logs" ADD CONSTRAINT "rag_query_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_query_logs" ADD CONSTRAINT "rag_query_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_query_logs" ADD CONSTRAINT "rag_query_logs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_database_id_databases_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."databases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_routed_from_agent_id_agents_id_fk" FOREIGN KEY ("routed_from_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_routed_from_team_id_teams_id_fk" FOREIGN KEY ("routed_from_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_current_organization_id_organizations_id_fk" FOREIGN KEY ("current_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "agents_view_permission" ON "agents" AS PERMISSIVE FOR SELECT TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND (
        owner_id = current_setting('app.current_user_id')::uuid
        OR user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'agents:view',
          organization_id,
          'agent',
          id
        )
      ));--> statement-breakpoint
CREATE POLICY "agents_manage_permission" ON "agents" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND (
        owner_id = current_setting('app.current_user_id')::uuid
        OR user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'agents:manage',
          organization_id,
          'agent',
          id
        )
      )) WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer
      AND (
        owner_id = current_setting('app.current_user_id')::uuid
        OR user_has_permission(
          current_setting('app.current_user_id')::uuid,
          'agents:manage',
          organization_id,
          'agent',
          id
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
          organization_id,
          'agent',
          id
        )
      ));--> statement-breakpoint
CREATE POLICY "chat_messages_tenant_isolation" ON "chat_messages" AS PERMISSIVE FOR ALL TO public USING (EXISTS (SELECT 1 FROM chats c WHERE c.id = chat_id AND c.organization_id = current_setting('app.current_organization_id')::integer));--> statement-breakpoint
CREATE POLICY "chats_tenant_isolation" ON "chats" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
CREATE POLICY "databases_tenant_isolation" ON "databases" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
CREATE POLICY "fields_tenant_isolation" ON "fields" AS PERMISSIVE FOR ALL TO public USING (EXISTS (SELECT 1 FROM tables t WHERE t.id = table_id AND t.organization_id = current_setting('app.current_organization_id')::integer));--> statement-breakpoint
CREATE POLICY "invitations_tenant_isolation" ON "invitations" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
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
CREATE POLICY "roles_tenant_isolation" ON "roles" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer OR is_system = true);--> statement-breakpoint
CREATE POLICY "tables_tenant_isolation" ON "tables" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
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
CREATE POLICY "tasks_agent_assignment_rbac" ON "tasks" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
      agent_id IS NULL 
      OR user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'tasks:assign',
        current_setting('app.current_organization_id')::integer,
        'agent',
        agent_id
      )
    );--> statement-breakpoint
CREATE POLICY "tasks_team_assignment_rbac" ON "tasks" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (
      team_id IS NULL
      OR user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'tasks:assign',
        current_setting('app.current_organization_id')::integer,
        'team',
        team_id
      )
    );--> statement-breakpoint
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
        organization_id,
        'team',
        id
      ));--> statement-breakpoint
CREATE POLICY "teams_manage_permission" ON "teams" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'teams:manage',
        organization_id,
        'team',
        id
      )) WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'teams:manage',
        organization_id,
        'team',
        id
      ));--> statement-breakpoint
CREATE POLICY "teams_create_permission" ON "teams" AS PERMISSIVE FOR INSERT TO public WITH CHECK (organization_id = current_setting('app.current_organization_id')::integer
      AND user_has_permission(
        current_setting('app.current_user_id')::uuid,
        'teams:create',
        organization_id
      ));--> statement-breakpoint
CREATE POLICY "user_organizations_isolation" ON "user_organizations" AS PERMISSIVE FOR ALL TO public USING (user_id = current_setting('app.current_user_id')::uuid AND organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
CREATE POLICY "user_roles_tenant_isolation" ON "user_roles" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_setting('app.current_organization_id')::integer);--> statement-breakpoint
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
      ));