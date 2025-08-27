-- Row Level Security Helper Functions for Multi-Tenancy
-- These functions support the RLS policies defined in the schema

-- Get current organization ID from app context
CREATE OR REPLACE FUNCTION get_current_organization_id()
RETURNS integer AS $$
DECLARE
    current_org_id integer;
    user_id_setting text;
BEGIN
    -- Try to get from current_setting (set by application)
    BEGIN
        current_org_id := current_setting('app.current_organization_id')::integer;
        RETURN current_org_id;
    EXCEPTION WHEN OTHERS THEN
        -- Fallback for migrations or non-interactive sessions
        user_id_setting := current_setting('app.current_user_id', true);
        IF user_id_setting IS NULL OR user_id_setting = '' THEN
            RETURN NULL;
        END IF;

        SELECT current_organization_id INTO current_org_id
        FROM users
        WHERE id = user_id_setting::uuid;

        RETURN current_org_id;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to RLS functions
GRANT EXECUTE ON FUNCTION get_current_organization_id() TO PUBLIC;