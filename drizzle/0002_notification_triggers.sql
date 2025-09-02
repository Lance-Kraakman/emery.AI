-- Database Notification Triggers for Real-Time Task Processing
-- Handles real-time notifications for task scheduling and RAG re-indexing

-- =============================================================================
-- TASK NOTIFICATION TRIGGERS
-- =============================================================================

-- Function to send task notification for scheduler
CREATE OR REPLACE FUNCTION notify_new_task()
RETURNS TRIGGER AS $$
BEGIN
    -- Send notification for task scheduler (scheduler expects task_event)
    PERFORM pg_notify(
        'task_event',
        json_build_object(
            'event_type', 'task_created',
            'taskId', NEW.id,
            'agentId', NEW.agent_id,
            'organizationId', NEW.organization_id,
            'instructions', (NEW.instructions->>'instructions'),
            'tools', COALESCE(NEW.instructions->'tools', '[]'::jsonb),
            'servers', COALESCE(NEW.instructions->'servers', '[]'::jsonb),
            'userId', NEW.created_by
        )::text
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

-- Create trigger on tasks table for new task notifications
DROP TRIGGER IF EXISTS trigger_new_task_created ON tasks;--> statement-breakpoint
CREATE TRIGGER trigger_new_task_created
    AFTER INSERT ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_task();--> statement-breakpoint

-- =============================================================================
-- RAG RE-INDEXING TRIGGERS
-- =============================================================================
-- Automatically notify the RAG dispatcher when data changes that affect indexes
-- Uses PostgreSQL LISTEN/NOTIFY for real-time event-driven re-indexing

-- Generic function for organization-level changes
CREATE OR REPLACE FUNCTION notify_rag_reindex_organization()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('rag_reindex_needed', json_build_object(
    'organizationId', COALESCE(NEW.id, OLD.id),
    'domainType', 'organizations',
    'changeType', TG_OP,
    'sourceId', COALESCE(NEW.id, OLD.id)::text,
    'timestamp', extract(epoch from now())
  )::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

-- Function for agent changes
CREATE OR REPLACE FUNCTION notify_rag_reindex_agents()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('rag_reindex_needed', json_build_object(
    'organizationId', COALESCE(NEW.organization_id, OLD.organization_id),
    'domainType', 'agents',
    'changeType', TG_OP,
    'sourceId', COALESCE(NEW.id, OLD.id)::text,
    'timestamp', extract(epoch from now())
  )::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

-- Function for table schema changes
CREATE OR REPLACE FUNCTION notify_rag_reindex_tables()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('rag_reindex_needed', json_build_object(
    'organizationId', COALESCE(NEW.organization_id, OLD.organization_id),
    'domainType', 'tables',
    'changeType', TG_OP,
    'sourceId', COALESCE(NEW.id, OLD.id)::text,
    'metadata', json_build_object(
      'tableName', COALESCE(NEW.name, OLD.name),
      'databaseId', COALESCE(NEW.database_id, OLD.database_id)
    ),
    'timestamp', extract(epoch from now())
  )::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

-- Organizations trigger
DROP TRIGGER IF EXISTS rag_reindex_organization_trigger ON organizations;--> statement-breakpoint
CREATE TRIGGER rag_reindex_organization_trigger
  AFTER INSERT OR UPDATE OR DELETE ON organizations
  FOR EACH ROW EXECUTE FUNCTION notify_rag_reindex_organization();--> statement-breakpoint

-- Agents trigger  
DROP TRIGGER IF EXISTS rag_reindex_agents_trigger ON agents;--> statement-breakpoint
CREATE TRIGGER rag_reindex_agents_trigger
  AFTER INSERT OR UPDATE OR DELETE ON agents
  FOR EACH ROW EXECUTE FUNCTION notify_rag_reindex_agents();--> statement-breakpoint

-- Tables trigger
DROP TRIGGER IF EXISTS rag_reindex_tables_trigger ON tables;--> statement-breakpoint
CREATE TRIGGER rag_reindex_tables_trigger
  AFTER INSERT OR UPDATE OR DELETE ON tables
  FOR EACH ROW EXECUTE FUNCTION notify_rag_reindex_tables();--> statement-breakpoint