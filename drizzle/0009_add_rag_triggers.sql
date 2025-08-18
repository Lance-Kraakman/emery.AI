-- Migration: Add PostgreSQL triggers for RAG re-indexing notifications
-- This enables the RAG dispatcher to automatically re-index when data changes

-- =============================================================================
-- RAG RE-INDEXING TRIGGER FUNCTIONS
-- =============================================================================

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

-- =============================================================================
-- RAG RE-INDEXING TRIGGERS
-- =============================================================================

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