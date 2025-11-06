-- Custom SQL migration file, put your code below! --

-- =============================================================================
-- GRANT PERMISSIONS (after role is created in 0001)
-- =============================================================================

-- Grant execute permission to authenticated users (RLS policies need this)
-- Enhanced function with 5 parameters (2 optional with defaults)
GRANT EXECUTE ON FUNCTION user_has_permission(UUID, TEXT, INTEGER, TEXT, INTEGER) TO authenticated;
-- Also grant execute on helper functions
GRANT EXECUTE ON FUNCTION is_resource_owned_by_user(TEXT, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_resource_in_user_teams(TEXT, INTEGER, UUID) TO authenticated;--> statement-breakpoint

-- =============================================================================
-- NOTIFICATION & TRIGGER FUNCTIONS (must be created before triggers)
-- =============================================================================

-- Notify new task creation for scheduler
CREATE OR REPLACE FUNCTION notify_new_task() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM pg_notify('task_event', json_build_object(
            'taskId', NEW.id,
            'organizationId', NEW.organization_id,
            'agentId', NEW.agent_id,
            'createdAt', NEW.created_at
        )::text);
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;