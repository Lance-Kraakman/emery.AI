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

-- AIDEV-NOTE: Enhanced RBAC permission checking function for RLS policies
-- Supports both global and resource-specific permissions with backward compatibility
CREATE OR REPLACE FUNCTION user_has_permission(
  check_user_id UUID,
  permission_string TEXT,
  org_id INTEGER,
  resource_type TEXT DEFAULT NULL,  -- 'agent', 'team', 'user', null for global only
  resource_id INTEGER DEFAULT NULL  -- specific resource ID, null for scoped permissions
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id  
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = check_user_id
    AND ur.organization_id = org_id
    AND p.resource || ':' || p.action = permission_string
    AND (
      -- Global permission (works for any resource)
      rp.resource_type IS NULL
      -- OR resource-specific permission
      OR (
        user_has_permission.resource_type IS NOT NULL 
        AND rp.resource_type = user_has_permission.resource_type 
        AND (
          rp.resource_scope = 'all'
          OR (rp.resource_scope = 'specific' AND rp.resource_id = user_has_permission.resource_id)
          OR (rp.resource_scope = 'owned' AND is_resource_owned_by_user(user_has_permission.resource_type, user_has_permission.resource_id, check_user_id))
          OR (rp.resource_scope = 'team' AND is_resource_in_user_teams(user_has_permission.resource_type, user_has_permission.resource_id, check_user_id))
        )
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;--> statement-breakpoint



-- AIDEV-NOTE: Helper function to check if user owns a specific resource
-- Supports 'agent' and 'team' resource types with ownership semantics
CREATE OR REPLACE FUNCTION is_resource_owned_by_user(
  resource_type TEXT,
  resource_id INTEGER, 
  user_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  IF resource_type = 'agent' THEN
    RETURN EXISTS (SELECT 1 FROM agents WHERE id = resource_id AND owner_id = is_resource_owned_by_user.user_id);
  ELSIF resource_type = 'team' THEN
    -- Teams don't have owners, but team leads could be considered "owners"
    RETURN EXISTS (
      SELECT 1 FROM team_memberships tm
      WHERE tm.team_id = resource_id AND tm.user_id = is_resource_owned_by_user.user_id AND tm.role = 'lead'
    );
  END IF;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;--> statement-breakpoint

-- AIDEV-NOTE: Helper function to check if resource belongs to user's teams
-- Supports 'agent' and 'team' resource types with team membership semantics
CREATE OR REPLACE FUNCTION is_resource_in_user_teams(
  resource_type TEXT,
  resource_id INTEGER,
  user_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  IF resource_type = 'agent' THEN
    RETURN EXISTS (
      SELECT 1 FROM agents a
      JOIN team_memberships tm ON a.team_id = tm.team_id
      WHERE a.id = resource_id AND tm.user_id = is_resource_in_user_teams.user_id
    );
  ELSIF resource_type = 'team' THEN
    RETURN EXISTS (
      SELECT 1 FROM team_memberships tm
      WHERE tm.team_id = resource_id AND tm.user_id = is_resource_in_user_teams.user_id
    );
  END IF;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;--> statement-breakpoint
