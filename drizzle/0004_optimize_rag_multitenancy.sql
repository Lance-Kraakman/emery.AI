-- Optimized Multi-Tenant RAG System with Vector Isolation
-- This migration fixes RLS policies and adds performance optimizations for vector search

-- =============================================================================
-- STEP 1: FIX RAG RLS POLICIES (Correct Column Names)
-- =============================================================================

-- Drop the incorrectly named policies from previous migration
DROP POLICY IF EXISTS "rag_documents_tenant_isolation" ON rag_documents;
DROP POLICY IF EXISTS "rag_query_logs_tenant_isolation" ON rag_query_logs;

-- RAG documents inherit organization from rag_indexes
CREATE POLICY "rag_documents_tenant_isolation" ON rag_documents
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM rag_indexes ri
            WHERE ri.id = rag_documents.rag_index_id
            AND ri.organization_id = get_current_organization_id()
        )
    );

-- RAG query logs inherit organization from rag_indexes  
CREATE POLICY "rag_query_logs_tenant_isolation" ON rag_query_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM rag_indexes ri
            WHERE ri.id = rag_query_logs.rag_index_id
            AND ri.organization_id = get_current_organization_id()
        )
    );

-- =============================================================================
-- STEP 2: ADD DENORMALIZED ORGANIZATION_ID FOR PERFORMANCE
-- =============================================================================

-- Add organization_id to rag_documents for faster queries (denormalized)
ALTER TABLE rag_documents ADD COLUMN organization_id integer;

-- Populate organization_id from rag_indexes
UPDATE rag_documents 
SET organization_id = ri.organization_id
FROM rag_indexes ri
WHERE rag_documents.rag_index_id = ri.id;

-- Make it NOT NULL for future inserts
ALTER TABLE rag_documents ALTER COLUMN organization_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE rag_documents ADD CONSTRAINT rag_documents_organization_id_fk 
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- Add organization_id to rag_query_logs for faster queries (denormalized)
ALTER TABLE rag_query_logs ADD COLUMN organization_id integer;

-- Populate organization_id from rag_indexes
UPDATE rag_query_logs 
SET organization_id = ri.organization_id
FROM rag_indexes ri
WHERE rag_query_logs.rag_index_id = ri.id;

-- Add foreign key constraint (nullable for backward compatibility)
ALTER TABLE rag_query_logs ADD CONSTRAINT rag_query_logs_organization_id_fk 
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

-- =============================================================================
-- STEP 3: CREATE HIGH-PERFORMANCE VECTOR INDEXES
-- =============================================================================

-- Create optimized vector indexes with organization pre-filtering
-- This dramatically improves vector search performance in multi-tenant scenarios

-- Composite index on organization_id + embedding for rag_documents
-- This allows pgvector to pre-filter by organization before vector similarity search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rag_documents_org_embedding 
    ON rag_documents USING ivfflat (organization_id, embedding vector_cosine_ops) 
    WITH (lists = 100);

-- Alternative L2 distance index for different similarity metrics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rag_documents_org_embedding_l2 
    ON rag_documents USING ivfflat (organization_id, embedding) 
    WITH (lists = 100);

-- Organization-first index for fast filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rag_documents_org_id 
    ON rag_documents(organization_id);

-- Source filtering within organization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rag_documents_org_source 
    ON rag_documents(organization_id, source_type, source_id);

-- Content hash lookup within organization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rag_documents_org_hash 
    ON rag_documents(organization_id, content_hash);

-- =============================================================================
-- STEP 4: OPTIMIZE RAG_QUERY_LOGS FOR ANALYTICS
-- =============================================================================

-- Fast query lookup within organization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rag_query_logs_org_time 
    ON rag_query_logs(organization_id, created_at DESC);

-- Agent-specific query analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rag_query_logs_org_agent 
    ON rag_query_logs(organization_id, agent_id) 
    WHERE agent_id IS NOT NULL;

-- User-specific query analytics  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rag_query_logs_org_user 
    ON rag_query_logs(organization_id, user_id) 
    WHERE user_id IS NOT NULL;

-- =============================================================================
-- STEP 5: UPDATE RLS POLICIES WITH DENORMALIZED ORGANIZATION_ID
-- =============================================================================

-- Use denormalized organization_id for faster policy evaluation
DROP POLICY IF EXISTS "rag_documents_tenant_isolation" ON rag_documents;
CREATE POLICY "rag_documents_tenant_isolation" ON rag_documents
    FOR ALL USING (
        organization_id = get_current_organization_id()
    );

-- Update rag_query_logs policy to use denormalized column when available
DROP POLICY IF EXISTS "rag_query_logs_tenant_isolation" ON rag_query_logs;
CREATE POLICY "rag_query_logs_tenant_isolation" ON rag_query_logs
    FOR ALL USING (
        organization_id = get_current_organization_id()
        OR (
            organization_id IS NULL 
            AND EXISTS (
                SELECT 1 FROM rag_indexes ri
                WHERE ri.id = rag_query_logs.rag_index_id
                AND ri.organization_id = get_current_organization_id()
            )
        )
    );

-- =============================================================================
-- STEP 6: CREATE FUNCTION FOR OPTIMIZED VECTOR SEARCH
-- =============================================================================

-- Function for organization-scoped vector similarity search
CREATE OR REPLACE FUNCTION search_rag_documents_by_organization(
    org_id integer,
    query_embedding vector(1024),
    similarity_threshold float DEFAULT 0.5,
    max_results integer DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    rag_index_id uuid,
    source_type text,
    source_id text,
    source_name text,
    title text,
    content text,
    metadata jsonb,
    similarity_score float
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rd.id,
        rd.rag_index_id,
        rd.source_type,
        rd.source_id,
        rd.source_name,
        rd.title,
        rd.content,
        rd.metadata,
        (1 - (rd.embedding <=> query_embedding)) as similarity_score
    FROM rag_documents rd
    WHERE rd.organization_id = org_id
      AND (1 - (rd.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY rd.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 7: CREATE TRIGGERS TO MAINTAIN DENORMALIZED ORGANIZATION_ID
-- =============================================================================

-- Function to automatically set organization_id on rag_documents
CREATE OR REPLACE FUNCTION set_rag_document_organization_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Get organization_id from the rag_index
    SELECT organization_id INTO NEW.organization_id
    FROM rag_indexes
    WHERE id = NEW.rag_index_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-populate organization_id on insert
CREATE TRIGGER set_rag_document_org_id_trigger
    BEFORE INSERT ON rag_documents
    FOR EACH ROW
    EXECUTE FUNCTION set_rag_document_organization_id();

-- Function to automatically set organization_id on rag_query_logs
CREATE OR REPLACE FUNCTION set_rag_query_log_organization_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Get organization_id from the rag_index
    SELECT organization_id INTO NEW.organization_id
    FROM rag_indexes
    WHERE id = NEW.rag_index_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-populate organization_id on insert
CREATE TRIGGER set_rag_query_log_org_id_trigger
    BEFORE INSERT ON rag_query_logs
    FOR EACH ROW
    EXECUTE FUNCTION set_rag_query_log_organization_id();

-- =============================================================================
-- STEP 8: GRANT PERMISSIONS
-- =============================================================================

-- Grant execute permissions on the new search function
GRANT EXECUTE ON FUNCTION search_rag_documents_by_organization(integer, vector(1024), float, integer) TO PUBLIC;

-- =============================================================================
-- STEP 9: ADD VACUUM AND ANALYZE FOR VECTOR INDEXES
-- =============================================================================

-- Analyze tables for better query planning with new indexes
ANALYZE rag_documents;
ANALYZE rag_query_logs;
ANALYZE rag_indexes;