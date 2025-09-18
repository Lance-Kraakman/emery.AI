-- Custom SQL migration file, put your code below! --

-- Function to automatically assign system user to new organizations
CREATE OR REPLACE FUNCTION assign_system_user_to_new_org() RETURNS TRIGGER AS $$
BEGIN
    -- Get System Service role ID and assign system user to the new organization
    INSERT INTO user_roles (user_id, role_id, organization_id)
    SELECT 
        'bdd640fb-0667-4ad1-9c80-317fa3b1799d'::uuid,
        r.id,
        NEW.id
    FROM roles r 
    WHERE r.name = 'System Service'
    ON CONFLICT DO NOTHING;
    
    -- Also add system user to user_organizations for membership consistency
    INSERT INTO user_organizations (user_id, organization_id)
    VALUES ('bdd640fb-0667-4ad1-9c80-317fa3b1799d'::uuid, NEW.id)
    ON CONFLICT DO NOTHING;
    
    -- Log the assignment (optional)
    RAISE NOTICE 'System user auto-assigned to new organization: % (role + membership)', NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute the function when new organizations are created
CREATE OR REPLACE TRIGGER trigger_assign_system_user_to_new_org
    AFTER INSERT ON organizations
    FOR EACH ROW 
    EXECUTE FUNCTION assign_system_user_to_new_org();

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION assign_system_user_to_new_org() TO authenticated;