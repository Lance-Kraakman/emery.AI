-- Row Level Security (RLS) Implementation for Multi-Tenancy
-- This migration implements comprehensive RLS policies for all organization-scoped tables

-- =============================================================================
-- STEP 1: UPDATE EXISTING TASKS WITH ORGANIZATION_ID
-- =============================================================================

-- Populate organization_id for existing tasks based on their agent's organization
UPDATE tasks 
SET organization_id = agents.organization_id
FROM agents 
WHERE tasks.agent_id = agents.id
AND tasks.organization_id IS NULL;

-- =============================================================================
-- STEP 2: ENABLE ROW LEVEL SECURITY ON ALL ORGANIZATION-SCOPED TABLES
-- =============================================================================

-- Core tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Data tables
ALTER TABLE databases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE fields ENABLE ROW LEVEL SECURITY;

-- Auth & access tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Team tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_memberships ENABLE ROW LEVEL SECURITY;

-- RAG tables
ALTER TABLE rag_indexes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_query_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 3: CREATE HELPER FUNCTIONS FOR RLS POLICIES
-- =============================================================================

-- Get current user's organization ID from session or API key
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current user has access to organization
CREATE OR REPLACE FUNCTION user_has_organization_access(org_id integer)
RETURNS boolean AS $$
BEGIN
    -- Check if user is member of organization
    RETURN EXISTS (
        SELECT 1 FROM user_organizations uo
        JOIN users u ON uo.user_id = u.id
        WHERE uo.organization_id = org_id
        AND u.id = current_setting('app.current_user_id')::uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 4: ORGANIZATIONS TABLE POLICIES
-- =============================================================================

-- Users can only see organizations they belong to
CREATE POLICY "organizations_tenant_isolation" ON organizations
    FOR ALL USING (
        id = get_current_organization_id() 
        OR user_has_organization_access(id)
    );

-- =============================================================================
-- STEP 5: USERS TABLE POLICIES  
-- =============================================================================

-- Users can see other users in their current organization
CREATE POLICY "users_tenant_isolation" ON users
    FOR ALL USING (
        current_organization_id = get_current_organization_id()
        OR id = current_setting('app.current_user_id')::uuid
        OR EXISTS (
            SELECT 1 FROM user_organizations uo
            WHERE uo.user_id = users.id
            AND uo.organization_id = get_current_organization_id()
        )
    );

-- =============================================================================
-- STEP 6: AGENTS TABLE POLICIES
-- =============================================================================

-- Users can only see agents in their organization
CREATE POLICY "agents_tenant_isolation" ON agents
    FOR ALL USING (
        organization_id = get_current_organization_id()
        OR organization_id IS NULL -- Allow null for backward compatibility
    );

-- =============================================================================
-- STEP 7: TASKS TABLE POLICIES
-- =============================================================================

-- Users can only see tasks in their organization
CREATE POLICY "tasks_tenant_isolation" ON tasks
    FOR ALL USING (
        organization_id = get_current_organization_id()
    );

-- =============================================================================
-- STEP 8: DATABASE & TABLE POLICIES
-- =============================================================================

-- Databases are organization-scoped
CREATE POLICY "databases_tenant_isolation" ON databases
    FOR ALL USING (
        organization_id = get_current_organization_id()
    );

-- Tables are organization-scoped
CREATE POLICY "tables_tenant_isolation" ON tables
    FOR ALL USING (
        organization_id = get_current_organization_id()
    );

-- Fields inherit organization from tables
CREATE POLICY "fields_tenant_isolation" ON fields
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM tables t
            WHERE t.id = fields.table_id
            AND t.organization_id = get_current_organization_id()
        )
    );

-- =============================================================================
-- STEP 9: ROLES & PERMISSIONS POLICIES
-- =============================================================================

-- Roles are organization-scoped
CREATE POLICY "roles_tenant_isolation" ON roles
    FOR ALL USING (
        organization_id = get_current_organization_id()
    );

-- User-organization relationships
CREATE POLICY "user_organizations_tenant_isolation" ON user_organizations
    FOR ALL USING (
        organization_id = get_current_organization_id()
        OR user_id = current_setting('app.current_user_id')::uuid
    );

-- Invitations are organization-scoped
CREATE POLICY "invitations_tenant_isolation" ON invitations
    FOR ALL USING (
        organization_id = get_current_organization_id()
    );

-- =============================================================================
-- STEP 10: TEAM POLICIES
-- =============================================================================

-- Teams are organization-scoped
CREATE POLICY "teams_tenant_isolation" ON teams
    FOR ALL USING (
        organization_id = get_current_organization_id()
    );

-- Team memberships inherit from teams
CREATE POLICY "team_memberships_tenant_isolation" ON team_memberships
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM teams t
            WHERE t.id = team_memberships.team_id
            AND t.organization_id = get_current_organization_id()
        )
    );

-- =============================================================================
-- STEP 11: RAG SYSTEM POLICIES
-- =============================================================================

-- RAG indexes are organization-scoped
CREATE POLICY "rag_indexes_tenant_isolation" ON rag_indexes
    FOR ALL USING (
        organization_id = get_current_organization_id()
    );

-- RAG documents inherit from indexes
CREATE POLICY "rag_documents_tenant_isolation" ON rag_documents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM rag_indexes ri
            WHERE ri.id = rag_documents.index_id
            AND ri.organization_id = get_current_organization_id()
        )
    );

-- RAG query logs are organization-scoped
CREATE POLICY "rag_query_logs_tenant_isolation" ON rag_query_logs
    FOR ALL USING (
        organization_id = get_current_organization_id()
    );

-- =============================================================================
-- STEP 12: CREATE INDEXES FOR RLS PERFORMANCE
-- =============================================================================

-- Add indexes on organization_id columns for better RLS performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agents_organization_id ON agents(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_organization_id ON tasks(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_databases_organization_id ON databases(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tables_organization_id ON tables(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_roles_organization_id ON roles(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teams_organization_id ON teams(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rag_indexes_organization_id ON rag_indexes(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_organizations_org_id ON user_organizations(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_organizations_user_id ON user_organizations(user_id);

-- =============================================================================
-- STEP 13: GRANT PERMISSIONS FOR RLS FUNCTIONS
-- =============================================================================

-- Grant execute permissions on RLS helper functions
GRANT EXECUTE ON FUNCTION get_current_organization_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION user_has_organization_access(integer) TO PUBLIC;