-- Custom SQL migration file, put your code below! --

-- =============================================================================
-- TRIGGERS (must be created after tables and functions exist)
-- =============================================================================

-- Task notification trigger
DROP TRIGGER IF EXISTS task_notification_trigger ON tasks;--> statement-breakpoint
CREATE TRIGGER task_notification_trigger
    AFTER INSERT ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_task();--> statement-breakpoint

-- RAG reindexing triggers
DROP TRIGGER IF EXISTS rag_reindex_organizations_trigger ON organizations;--> statement-breakpoint
CREATE TRIGGER rag_reindex_organizations_trigger
    AFTER INSERT OR UPDATE OR DELETE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION notify_rag_reindex_organizations();--> statement-breakpoint

DROP TRIGGER IF EXISTS rag_reindex_agents_trigger ON agents;--> statement-breakpoint
CREATE TRIGGER rag_reindex_agents_trigger
    AFTER INSERT OR UPDATE OR DELETE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION notify_rag_reindex_agents();--> statement-breakpoint

DROP TRIGGER IF EXISTS rag_reindex_tables_trigger ON tables;--> statement-breakpoint
CREATE TRIGGER rag_reindex_tables_trigger
    AFTER INSERT OR UPDATE OR DELETE ON tables
    FOR EACH ROW
    EXECUTE FUNCTION notify_rag_reindex_tables();--> statement-breakpoint

DROP TRIGGER IF EXISTS rag_reindex_teams_trigger ON teams;--> statement-breakpoint
CREATE TRIGGER rag_reindex_teams_trigger
    AFTER INSERT OR UPDATE OR DELETE ON teams
    FOR EACH ROW
    EXECUTE FUNCTION notify_rag_reindex_teams();--> statement-breakpoint

DROP TRIGGER IF EXISTS rag_reindex_tasks_trigger ON tasks;--> statement-breakpoint
CREATE TRIGGER rag_reindex_tasks_trigger
    AFTER INSERT OR UPDATE OR DELETE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION notify_rag_reindex_tasks();