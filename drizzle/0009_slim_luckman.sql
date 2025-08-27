ALTER TABLE "agents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "databases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "fields" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rag_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rag_indexes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rag_query_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tables" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "team_memberships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "agents_tenant_isolation" ON "agents" AS PERMISSIVE FOR ALL TO public USING (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "chat_messages_tenant_isolation" ON "chat_messages" AS PERMISSIVE FOR ALL TO public USING (EXISTS (SELECT 1 FROM chats c WHERE c.id = chat_id AND c.organization_id = get_current_organization_id()));--> statement-breakpoint
CREATE POLICY "chats_tenant_isolation" ON "chats" AS PERMISSIVE FOR ALL TO public USING (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "databases_tenant_isolation" ON "databases" AS PERMISSIVE FOR ALL TO public USING (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "fields_tenant_isolation" ON "fields" AS PERMISSIVE FOR ALL TO public USING (EXISTS (SELECT 1 FROM tables t WHERE t.id = table_id AND t.organization_id = get_current_organization_id()));--> statement-breakpoint
CREATE POLICY "invitations_tenant_isolation" ON "invitations" AS PERMISSIVE FOR ALL TO public USING (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "organizations_member_access" ON "organizations" AS PERMISSIVE FOR ALL TO public USING (id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "rag_documents_tenant_isolation" ON "rag_documents" AS PERMISSIVE FOR ALL TO public USING (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "rag_indexes_tenant_isolation" ON "rag_indexes" AS PERMISSIVE FOR ALL TO public USING (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "rag_query_logs_tenant_isolation" ON "rag_query_logs" AS PERMISSIVE FOR ALL TO public USING (organization_id = get_current_organization_id() OR (organization_id IS NULL AND EXISTS (SELECT 1 FROM rag_indexes ri WHERE ri.id = rag_index_id AND ri.organization_id = get_current_organization_id())));--> statement-breakpoint
CREATE POLICY "roles_tenant_isolation" ON "roles" AS PERMISSIVE FOR ALL TO public USING (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "tables_tenant_isolation" ON "tables" AS PERMISSIVE FOR ALL TO public USING (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "tasks_tenant_isolation" ON "tasks" AS PERMISSIVE FOR ALL TO public USING (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "team_memberships_tenant_isolation" ON "team_memberships" AS PERMISSIVE FOR ALL TO public USING (EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.organization_id = get_current_organization_id()));--> statement-breakpoint
CREATE POLICY "teams_tenant_isolation" ON "teams" AS PERMISSIVE FOR ALL TO public USING (organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "user_organizations_isolation" ON "user_organizations" AS PERMISSIVE FOR ALL TO public USING (user_id = current_setting('app.current_user_id')::uuid AND organization_id = get_current_organization_id());--> statement-breakpoint
CREATE POLICY "users_org_isolation" ON "users" AS PERMISSIVE FOR ALL TO public USING (current_organization_id = get_current_organization_id());