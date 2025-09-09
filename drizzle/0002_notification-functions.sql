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
        PERFORM pg_notify('new_task', json_build_object(
            'task_id', NEW.id,
            'organization_id', NEW.organization_id,
            'agent_id', NEW.agent_id,
            'scheduled_at', NEW.scheduled_at
        )::text);
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

-- RAG reindexing notification functions
CREATE OR REPLACE FUNCTION notify_rag_reindex_organizations() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        PERFORM pg_notify('rag_reindex_organizations', json_build_object(
            'organization_id', NEW.id,
            'operation', TG_OP
        )::text);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM pg_notify('rag_reindex_organizations', json_build_object(
            'organization_id', OLD.id,
            'operation', TG_OP
        )::text);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE OR REPLACE FUNCTION notify_rag_reindex_agents() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        PERFORM pg_notify('rag_reindex_agents', json_build_object(
            'agent_id', NEW.id,
            'organization_id', NEW.organization_id,
            'operation', TG_OP
        )::text);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM pg_notify('rag_reindex_agents', json_build_object(
            'agent_id', OLD.id,
            'organization_id', OLD.organization_id,
            'operation', TG_OP
        )::text);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE OR REPLACE FUNCTION notify_rag_reindex_tables() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        PERFORM pg_notify('rag_reindex_tables', json_build_object(
            'table_id', NEW.id,
            'organization_id', NEW.organization_id,
            'operation', TG_OP
        )::text);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM pg_notify('rag_reindex_tables', json_build_object(
            'table_id', OLD.id,
            'organization_id', OLD.organization_id,
            'operation', TG_OP
        )::text);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE OR REPLACE FUNCTION notify_rag_reindex_teams() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        PERFORM pg_notify('rag_reindex_teams', json_build_object(
            'team_id', NEW.id,
            'organization_id', NEW.organization_id,
            'operation', TG_OP
        )::text);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM pg_notify('rag_reindex_teams', json_build_object(
            'team_id', OLD.id,
            'organization_id', OLD.organization_id,
            'operation', TG_OP
        )::text);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE OR REPLACE FUNCTION notify_rag_reindex_tasks() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        PERFORM pg_notify('rag_reindex_tasks', json_build_object(
            'task_id', NEW.id,
            'organization_id', NEW.organization_id,
            'operation', TG_OP
        )::text);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM pg_notify('rag_reindex_tasks', json_build_object(
            'task_id', OLD.id,
            'organization_id', OLD.organization_id,
            'operation', TG_OP
        )::text);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;