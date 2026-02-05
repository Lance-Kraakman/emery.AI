-- Custom SQL migration file, put your code below! --

-- =============================================================================
-- H-1: Fix RLS default fallback — fail-closed instead of fail-open
-- =============================================================================
-- Previously defaulted to organization_id = 1 when session var was not set,
-- silently leaking into Org 1's data. Now returns NULL, which matches no rows
-- in RLS policies (WHERE organization_id = get_current_organization_id()).

CREATE OR REPLACE FUNCTION get_current_organization_id()
RETURNS INTEGER AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_organization_id', true), '')::integer;
END;
$$ LANGUAGE plpgsql STABLE;--> statement-breakpoint

-- =============================================================================
-- M-4: Remove SECURITY DEFINER from notify_new_task trigger function
-- =============================================================================
-- pg_notify() is available to all users — no elevated privileges needed.
-- SECURITY DEFINER was running this function with the migration user's privileges
-- (typically superuser), which is an unnecessary privilege escalation surface.

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
$$ LANGUAGE plpgsql;
