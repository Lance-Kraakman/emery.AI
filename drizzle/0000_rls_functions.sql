-- RLS Functions for Multi-Tenant Organization Isolation
-- These functions must be created before the main schema migration

-- =============================================================================
-- RLS FUNCTIONS
-- =============================================================================

-- Create auth schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS auth;

-- Core RLS function for organization context
CREATE OR REPLACE FUNCTION get_current_organization_id()
RETURNS INTEGER AS $$
BEGIN
    -- Get from app.current_organization_id setting (set by application)
    RETURN COALESCE(
        current_setting('app.current_organization_id', true)::integer,
        1  -- Default to organization 1 for testing
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Authentication user ID function (simplified for non-Supabase)
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid AS $$
BEGIN
    -- Get from app.current_user_id setting (set by application)
    RETURN COALESCE(
        current_setting('app.current_user_id', true)::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid  -- Default for testing
    );
END;
$$ LANGUAGE plpgsql STABLE;