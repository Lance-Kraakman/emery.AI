-- AIDEV-NOTE: Database function for RBAC permission checking
-- Used by RLS policies to determine if a user has a specific permission
-- This function is called from within RLS policies for database-level security

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
  
  RETURN has_perm;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users (RLS policies need this)
GRANT EXECUTE ON FUNCTION user_has_permission(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_permission(UUID, TEXT, INTEGER) TO public;