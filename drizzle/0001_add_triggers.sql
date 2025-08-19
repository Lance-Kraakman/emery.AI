-- Database triggers for real-time task notifications
-- This trigger sends a notification when a new task is created

-- Function to send task notification
CREATE OR REPLACE FUNCTION notify_new_task()
RETURNS TRIGGER AS $$
BEGIN
    -- Send notification for manual tasks (dispatcher expects manual_task_created)
    PERFORM pg_notify(
        'manual_task_created',
        json_build_object(
            'taskId', NEW.id,
            'agentId', NEW.agent_id,
            'instructions', (NEW.instructions->>'instructions'),
            'tools', COALESCE(NEW.instructions->'tools', '[]'::jsonb),
            'servers', COALESCE(NEW.instructions->'servers', '[]'::jsonb),
            'userId', NEW.created_by
        )::text
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on tasks table
DROP TRIGGER IF EXISTS trigger_new_task_created ON tasks;
CREATE TRIGGER trigger_new_task_created
    AFTER INSERT ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_task();

-- STATUS CHANGE TRIGGER REMOVED TO PREVENT INFINITE LOOPS
-- Tasks should only be processed once when initially created
-- If retry functionality is needed, it should be handled explicitly via API

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
$$ LANGUAGE plpgsql;

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
$$ LANGUAGE plpgsql;

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
      'tableDbName', COALESCE(NEW.db_name, OLD.db_name)
    ),
    'timestamp', extract(epoch from now())
  )::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Organizations trigger
DROP TRIGGER IF EXISTS rag_reindex_organization_trigger ON organizations;
CREATE TRIGGER rag_reindex_organization_trigger
  AFTER INSERT OR UPDATE OR DELETE ON organizations
  FOR EACH ROW EXECUTE FUNCTION notify_rag_reindex_organization();

-- Agents trigger  
DROP TRIGGER IF EXISTS rag_reindex_agents_trigger ON agents;
CREATE TRIGGER rag_reindex_agents_trigger
  AFTER INSERT OR UPDATE OR DELETE ON agents
  FOR EACH ROW EXECUTE FUNCTION notify_rag_reindex_agents();

-- Tables trigger (for schema changes)
DROP TRIGGER IF EXISTS rag_reindex_tables_trigger ON tables;
CREATE TRIGGER rag_reindex_tables_trigger
  AFTER INSERT OR UPDATE OR DELETE ON tables
  FOR EACH ROW EXECUTE FUNCTION notify_rag_reindex_tables();