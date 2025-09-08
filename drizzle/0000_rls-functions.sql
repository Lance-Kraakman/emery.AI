-- Custom SQL migration file, put your code below! --

-- =============================================================================
-- RLS FUNCTIONS (must be created before schema)
-- =============================================================================

-- Create auth schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS auth;--> statement-breakpoint

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
$$ LANGUAGE plpgsql STABLE;--> statement-breakpoint

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
$$ LANGUAGE plpgsql STABLE;--> statement-breakpoint

-- AIDEV-NOTE: RBAC permission checking function for RLS policies
CREATE OR REPLACE FUNCTION user_has_permission(
  check_user_id UUID,
  permission_string TEXT,
  org_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  has_perm BOOLEAN;
BEGIN
  -- Check if user has the permission through their roles
  SELECT EXISTS (
    SELECT 1 
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id  
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = check_user_id
    AND ur.organization_id = org_id
    AND p.resource || ':' || p.action = permission_string
  ) INTO has_perm;

  RETURN COALESCE(has_perm, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;--> statement-breakpoint
