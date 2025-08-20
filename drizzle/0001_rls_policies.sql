-- Row Level Security (RLS) Implementation for Multi-Tenancy
-- Comprehensive RLS policies for organization-based data isolation

-- =============================================================================
-- STEP 1: ENABLE ROW LEVEL SECURITY ON ALL ORGANIZATION-SCOPED TABLES
-- =============================================================================

-- Core tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE users ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Data tables
ALTER TABLE databases ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE fields ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Auth & access tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Team tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE team_memberships ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- RAG tables
ALTER TABLE rag_indexes ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE rag_query_logs ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- =============================================================================
-- STEP 2: CREATE RLS HELPER FUNCTIONS
-- =============================================================================

-- Get current organization ID from app context or user context
CREATE OR REPLACE FUNCTION get_current_organization_id() 
RETURNS integer AS $$
DECLARE
    current_org_id integer;
BEGIN
    -- Try to get from current_setting (set by application)
    BEGIN
        current_org_id := current_setting('app.current_organization_id')::integer;
        RETURN current_org_id;
    EXCEPTION WHEN OTHERS THEN
        -- Fallback: get from users table via current user
        SELECT current_organization_id INTO current_org_id 
        FROM users 
        WHERE id = current_setting('app.current_user_id')::uuid;
        
        RETURN current_org_id;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;--> statement-breakpoint

-- Check if current user has access to organization
CREATE OR REPLACE FUNCTION user_has_organization_access(org_id integer)
RETURNS boolean AS $$
BEGIN
    -- Check if user is member of organization
    RETURN EXISTS (
        SELECT 1 FROM user_organizations uo 
        WHERE uo.user_id = current_setting('app.current_user_id')::uuid 
        AND uo.organization_id = org_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;--> statement-breakpoint

-- =============================================================================
-- STEP 3: CREATE RLS POLICIES FOR ALL TABLES
-- =============================================================================

-- Organizations: Users can only see orgs they belong to
CREATE POLICY "organizations_member_access" ON organizations
    FOR ALL USING (
        id = get_current_organization_id() 
    );--> statement-breakpoint

-- Users: Only see users in current organization
CREATE POLICY "users_org_isolation" ON users
    FOR ALL USING (
        current_organization_id = get_current_organization_id()
    );--> statement-breakpoint

-- User-organization relationships: only see own memberships within current org
CREATE POLICY "user_organizations_isolation" ON user_organizations
    FOR ALL USING (
        user_id = current_setting('app.current_user_id')::uuid 
            AND organization_id = get_current_organization_id()
    );--> statement-breakpoint

-- Agents are organization-scoped
CREATE POLICY "agents_tenant_isolation" ON agents
    FOR ALL USING (
        organization_id = get_current_organization_id()
        OR organization_id IS NULL -- Allow null for backward compatibility
    );--> statement-breakpoint

-- Tasks are organization-scoped
CREATE POLICY "tasks_tenant_isolation" ON tasks
    FOR ALL USING (
        organization_id = get_current_organization_id()
    );--> statement-breakpoint

-- Databases are organization-scoped
CREATE POLICY "databases_tenant_isolation" ON databases
    FOR ALL USING (
        organization_id = get_current_organization_id()
    );--> statement-breakpoint

-- Tables are organization-scoped
CREATE POLICY "tables_tenant_isolation" ON tables
    FOR ALL USING (
        organization_id = get_current_organization_id()
    );--> statement-breakpoint

-- Fields follow table organization (join-based policy)
CREATE POLICY "fields_tenant_isolation" ON fields
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM tables t 
            WHERE t.id = fields.table_id 
            AND t.organization_id = get_current_organization_id()
        )
    );--> statement-breakpoint

-- Roles are organization-scoped
CREATE POLICY "roles_tenant_isolation" ON roles
    FOR ALL USING (
        organization_id = get_current_organization_id()
    );--> statement-breakpoint

-- Invitations are organization-scoped
CREATE POLICY "invitations_tenant_isolation" ON invitations
    FOR ALL USING (
        organization_id = get_current_organization_id()
    );--> statement-breakpoint

-- Teams are organization-scoped
CREATE POLICY "teams_tenant_isolation" ON teams
    FOR ALL USING (
        organization_id = get_current_organization_id()
    );--> statement-breakpoint

-- Team memberships follow team organization (join-based policy)
CREATE POLICY "team_memberships_tenant_isolation" ON team_memberships
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM teams t 
            WHERE t.id = team_memberships.team_id 
            AND t.organization_id = get_current_organization_id()
        )
    );--> statement-breakpoint

-- RAG indexes are organization-scoped
CREATE POLICY "rag_indexes_tenant_isolation" ON rag_indexes
    FOR ALL USING (
        organization_id = get_current_organization_id()
    );--> statement-breakpoint

-- RAG documents are organization-scoped (uses denormalized organization_id)
CREATE POLICY "rag_documents_tenant_isolation" ON rag_documents
    FOR ALL USING (
        organization_id = get_current_organization_id()
    );--> statement-breakpoint

-- RAG query logs are organization-scoped (with fallback to rag_indexes)
CREATE POLICY "rag_query_logs_tenant_isolation" ON rag_query_logs
    FOR ALL USING (
        organization_id = get_current_organization_id()
        OR (
            organization_id IS NULL 
            AND EXISTS (
                SELECT 1 FROM rag_indexes ri 
                WHERE ri.id = rag_query_logs.rag_index_id 
                AND ri.organization_id = get_current_organization_id()
            )
        )
    );--> statement-breakpoint

-- =============================================================================
-- STEP 4: CREATE PERFORMANCE INDEXES
-- =============================================================================

-- Add indexes on organization_id columns for better RLS performance
CREATE INDEX IF NOT EXISTS idx_agents_organization_id ON agents(organization_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_tasks_organization_id ON tasks(organization_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_databases_organization_id ON databases(organization_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_tables_organization_id ON tables(organization_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_roles_organization_id ON roles(organization_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_teams_organization_id ON teams(organization_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_rag_indexes_organization_id ON rag_indexes(organization_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_rag_documents_organization_id ON rag_documents(organization_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_user_organizations_org_id ON user_organizations(organization_id);--> statement-breakpoint

-- =============================================================================
-- STEP 5: GRANT PERMISSIONS
-- =============================================================================

-- Grant access to RLS functions
GRANT EXECUTE ON FUNCTION user_has_organization_access(integer) TO PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION get_current_organization_id() TO PUBLIC;--> statement-breakpoint