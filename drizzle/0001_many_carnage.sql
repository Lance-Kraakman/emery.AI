CREATE ROLE "anon" WITH NOINHERIT;--> statement-breakpoint
CREATE ROLE "app_admin";--> statement-breakpoint
CREATE ROLE "app_member";--> statement-breakpoint
CREATE ROLE "app_owner";--> statement-breakpoint
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
	"domain_type" text,
	"domain_id" integer,
	"table_id" integer,
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
	"role" text DEFAULT 'member' NOT NULL,
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
	"embedding" vector(1024),
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
	"embedding_model" text DEFAULT 'BAAI/bge-m3',
	"embedding_dimensions" integer DEFAULT 1024,
	"status" text DEFAULT 'active',
	"last_indexed_at" timestamp,
	"document_count" integer DEFAULT 0,
	"created_by" uuid,
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
	"query_embedding" vector(1024),
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
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tables" (
	"id" serial PRIMARY KEY NOT NULL,
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
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "user_organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp,
	"image" text,
	"current_organization_id" integer,
	"organization_role" text DEFAULT 'member' NOT NULL,
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
ALTER TABLE "chats" ADD CONSTRAINT "chats_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "databases" ADD CONSTRAINT "databases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "databases" ADD CONSTRAINT "databases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_rag_index_id_rag_indexes_id_fk" FOREIGN KEY ("rag_index_id") REFERENCES "public"."rag_indexes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_indexes" ADD CONSTRAINT "rag_indexes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_indexes" ADD CONSTRAINT "rag_indexes_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_indexes" ADD CONSTRAINT "rag_indexes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_query_logs" ADD CONSTRAINT "rag_query_logs_rag_index_id_rag_indexes_id_fk" FOREIGN KEY ("rag_index_id") REFERENCES "public"."rag_indexes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_query_logs" ADD CONSTRAINT "rag_query_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_query_logs" ADD CONSTRAINT "rag_query_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_query_logs" ADD CONSTRAINT "rag_query_logs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_database_id_databases_id_fk" FOREIGN KEY ("database_id") REFERENCES "public"."databases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organizations" ADD CONSTRAINT "user_organizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_current_organization_id_organizations_id_fk" FOREIGN KEY ("current_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "agents_owner_management" ON "agents" AS PERMISSIVE FOR ALL TO "app_owner" USING (organization_id = get_current_organization_id() AND EXISTS(
      SELECT 1 FROM users WHERE id = auth.uid() 
      AND current_organization_id = agents.organization_id 
      AND organization_role = 'owner'
    )) WITH CHECK (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "agents_admin_view" ON "agents" AS PERMISSIVE FOR SELECT TO "app_admin" USING (organization_id = get_current_organization_id() AND EXISTS(
      SELECT 1 FROM users WHERE id = auth.uid() 
      AND current_organization_id = agents.organization_id 
      AND organization_role IN ('admin', 'owner')
    ));--> statement-breakpoint
CREATE POLICY "agents_member_view" ON "agents" AS PERMISSIVE FOR SELECT TO "app_member" USING (organization_id = get_current_organization_id() AND EXISTS(
      SELECT 1 FROM users WHERE id = auth.uid() 
      AND current_organization_id = agents.organization_id
    ));--> statement-breakpoint
CREATE POLICY "agents_owner_control" ON "agents" AS PERMISSIVE FOR ALL TO "authenticated" USING (owner_id = auth.uid() AND organization_id = get_current_organization_id()) WITH CHECK (owner_id = auth.uid() AND organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "chat_messages_tenant_isolation" ON "chat_messages" AS PERMISSIVE FOR ALL TO public USING (EXISTS (SELECT 1 FROM chats c WHERE c.id = chat_id AND c.organization_id = get_current_organization_id()));--> statement-breakpoint
CREATE POLICY "chats_tenant_isolation" ON "chats" AS PERMISSIVE FOR ALL TO public USING (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "databases_tenant_isolation" ON "databases" AS PERMISSIVE FOR ALL TO public USING (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "fields_tenant_isolation" ON "fields" AS PERMISSIVE FOR ALL TO public USING (EXISTS (SELECT 1 FROM tables t WHERE t.id = table_id AND t.organization_id = get_current_organization_id()));--> statement-breakpoint
CREATE POLICY "invitations_tenant_isolation" ON "invitations" AS PERMISSIVE FOR ALL TO public USING (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "organizations_member_access" ON "organizations" AS PERMISSIVE FOR ALL TO public USING (id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "organizations_owner_access" ON "organizations" AS PERMISSIVE FOR ALL TO "app_owner" USING (EXISTS (
      SELECT 1 FROM user_organizations 
      WHERE organization_id = "organizations"."id" 
      AND user_id = current_setting('app.current_user_id', true)::uuid
      AND role = 'owner'
    ));--> statement-breakpoint
CREATE POLICY "organizations_admin_access" ON "organizations" AS PERMISSIVE FOR SELECT TO "app_admin" USING (EXISTS (
      SELECT 1 FROM user_organizations 
      WHERE organization_id = "organizations"."id" 
      AND user_id = current_setting('app.current_user_id', true)::uuid
      AND role IN ('admin', 'owner')
    ));--> statement-breakpoint
CREATE POLICY "rag_documents_owner_management" ON "rag_documents" AS PERMISSIVE FOR ALL TO "app_owner" USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "rag_documents_admin_management" ON "rag_documents" AS PERMISSIVE FOR ALL TO "app_admin" USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "rag_documents_member_view" ON "rag_documents" AS PERMISSIVE FOR SELECT TO "app_member" USING (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "rag_indexes_owner_management" ON "rag_indexes" AS PERMISSIVE FOR ALL TO "app_owner" USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "rag_indexes_admin_management" ON "rag_indexes" AS PERMISSIVE FOR ALL TO "app_admin" USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "rag_indexes_member_view" ON "rag_indexes" AS PERMISSIVE FOR SELECT TO "app_member" USING (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "rag_indexes_creator_control" ON "rag_indexes" AS PERMISSIVE FOR ALL TO "authenticated" USING (created_by = auth.uid() AND organization_id = get_current_organization_id()) WITH CHECK (created_by = auth.uid() AND organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "rag_query_logs_owner_management" ON "rag_query_logs" AS PERMISSIVE FOR ALL TO "app_owner" USING (organization_id = get_current_organization_id() OR (organization_id IS NULL AND EXISTS (SELECT 1 FROM rag_indexes ri WHERE ri.id = rag_index_id AND ri.organization_id = get_current_organization_id()))) WITH CHECK (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "rag_query_logs_admin_management" ON "rag_query_logs" AS PERMISSIVE FOR ALL TO "app_admin" USING (organization_id = get_current_organization_id() OR (organization_id IS NULL AND EXISTS (SELECT 1 FROM rag_indexes ri WHERE ri.id = rag_index_id AND ri.organization_id = get_current_organization_id()))) WITH CHECK (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "rag_query_logs_user_access" ON "rag_query_logs" AS PERMISSIVE FOR SELECT TO "app_member", "authenticated" USING (user_id = auth.uid() AND (organization_id = get_current_organization_id() OR (organization_id IS NULL AND EXISTS (SELECT 1 FROM rag_indexes ri WHERE ri.id = rag_index_id AND ri.organization_id = get_current_organization_id()))));--> statement-breakpoint
CREATE POLICY "tables_tenant_isolation" ON "tables" AS PERMISSIVE FOR ALL TO public USING (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "tasks_owner_management" ON "tasks" AS PERMISSIVE FOR ALL TO "app_owner" USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "tasks_admin_management" ON "tasks" AS PERMISSIVE FOR SELECT TO "app_admin" USING (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "tasks_admin_updates" ON "tasks" AS PERMISSIVE FOR UPDATE TO "app_admin" USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "tasks_member_view" ON "tasks" AS PERMISSIVE FOR SELECT TO "app_member" USING (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "tasks_creator_control" ON "tasks" AS PERMISSIVE FOR ALL TO "authenticated" USING (created_by = auth.uid() AND organization_id = get_current_organization_id()) WITH CHECK (created_by = auth.uid() AND organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "team_memberships_owner_management" ON "team_memberships" AS PERMISSIVE FOR ALL TO "app_owner" USING (EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.organization_id = get_current_organization_id())) WITH CHECK (EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.organization_id = get_current_organization_id()));--> statement-breakpoint
CREATE POLICY "team_memberships_admin_management" ON "team_memberships" AS PERMISSIVE FOR ALL TO "app_admin" USING (EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.organization_id = get_current_organization_id())) WITH CHECK (EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.organization_id = get_current_organization_id()));--> statement-breakpoint
CREATE POLICY "team_memberships_member_view" ON "team_memberships" AS PERMISSIVE FOR SELECT TO "app_member" USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.organization_id = get_current_organization_id()));--> statement-breakpoint
CREATE POLICY "teams_owner_management" ON "teams" AS PERMISSIVE FOR ALL TO "app_owner" USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "teams_admin_management" ON "teams" AS PERMISSIVE FOR ALL TO "app_admin" USING (organization_id = get_current_organization_id()) WITH CHECK (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "teams_member_view" ON "teams" AS PERMISSIVE FOR SELECT TO "app_member" USING (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "user_organizations_isolation" ON "user_organizations" AS PERMISSIVE FOR ALL TO public USING (user_id = current_setting('app.current_user_id')::uuid AND organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "users_owner_management" ON "users" AS PERMISSIVE FOR ALL TO "app_owner" USING (current_organization_id = get_current_organization_id()) WITH CHECK (current_organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "users_admin_management" ON "users" AS PERMISSIVE FOR SELECT TO "app_admin" USING (current_organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "users_member_self" ON "users" AS PERMISSIVE FOR SELECT TO "app_member" USING (id = auth.uid());