-- Task RAG Notification Triggers
-- Automatically notify the RAG dispatcher when task data changes that affect indexes
-- Uses PostgreSQL LISTEN/NOTIFY for real-time event-driven re-indexing

-- Function for task changes
CREATE OR REPLACE FUNCTION notify_rag_reindex_tasks()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('rag_reindex_needed', json_build_object(
    'organizationId', COALESCE(NEW.organization_id, OLD.organization_id),
    'domainType', 'tasks',
    'changeType', TG_OP,
    'sourceId', COALESCE(NEW.id, OLD.id)::text,
    'metadata', json_build_object(
      'taskName', COALESCE(NEW.name, OLD.name),
      'taskId', COALESCE(NEW.id, OLD.id),
      'agentId', COALESCE(NEW.agent_id, OLD.agent_id),
      'status', COALESCE(NEW.status, OLD.status),
      'completedAt', COALESCE(NEW.completed_at, OLD.completed_at)
    ),
    'timestamp', extract(epoch from now())
  )::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

-- Tasks trigger
DROP TRIGGER IF EXISTS rag_reindex_tasks_trigger ON tasks;--> statement-breakpoint
CREATE TRIGGER rag_reindex_tasks_trigger
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION notify_rag_reindex_tasks();--> statement-breakpoint