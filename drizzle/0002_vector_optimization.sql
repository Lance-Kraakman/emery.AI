-- Vector Search Optimization for Multi-Tenant RAG
-- Performance optimizations and organization-scoped vector search

-- =============================================================================
-- STEP 1: PERFORMANCE INDEXES FOR VECTOR SEARCH
-- =============================================================================

-- Optimize RAG document queries by organization + vector search
CREATE INDEX IF NOT EXISTS idx_rag_documents_org_embedding ON rag_documents(organization_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_rag_documents_source ON rag_documents(organization_id, source_type, source_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_rag_documents_content_hash ON rag_documents(content_hash);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_rag_documents_indexed_at ON rag_documents(indexed_at DESC);--> statement-breakpoint

-- Optimize RAG query logs for analytics
CREATE INDEX IF NOT EXISTS idx_rag_query_logs_org_created ON rag_query_logs(organization_id, created_at DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_rag_query_logs_agent ON rag_query_logs(agent_id, created_at DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_rag_query_logs_user ON rag_query_logs(user_id, created_at DESC);--> statement-breakpoint

-- Vector indexes for similarity search (after data is populated)
CREATE INDEX IF NOT EXISTS idx_rag_documents_embedding_ivfflat ON rag_documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_rag_query_logs_embedding_ivfflat ON rag_query_logs USING ivfflat (query_embedding vector_cosine_ops) WITH (lists = 100);--> statement-breakpoint

-- Additional indexes for RAG workflow optimization
CREATE INDEX IF NOT EXISTS idx_rag_indexes_status_org ON rag_indexes(status, organization_id);--> statement-breakpoint

-- =============================================================================
-- STEP 2: ORGANIZATION-SCOPED VECTOR SEARCH FUNCTIONS
-- =============================================================================

-- Fast organization-scoped RAG document search with pre-filtering
CREATE OR REPLACE FUNCTION search_rag_documents_by_organization(
    org_id integer,
    query_embedding vector(1024),
    similarity_threshold numeric DEFAULT 0.7,
    result_limit integer DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    title text,
    content text,
    source_type text,
    source_name text,
    similarity numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rd.id,
        rd.title,
        rd.content,
        rd.source_type,
        rd.source_name,
        (1 - (rd.embedding <=> query_embedding)) as similarity
    FROM rag_documents rd
    WHERE rd.organization_id = org_id
      AND rd.embedding IS NOT NULL
      AND (1 - (rd.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY rd.embedding <=> query_embedding
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;--> statement-breakpoint

-- Get RAG statistics by organization
CREATE OR REPLACE FUNCTION get_rag_stats_by_organization(org_id integer)
RETURNS TABLE (
    total_documents bigint,
    documents_with_embeddings bigint,
    avg_content_length numeric,
    last_indexed_at timestamp
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM rag_documents WHERE organization_id = org_id) as total_documents,
        (SELECT COUNT(*) FROM rag_documents WHERE organization_id = org_id AND embedding IS NOT NULL) as documents_with_embeddings,
        (SELECT AVG(LENGTH(content)) FROM rag_documents WHERE organization_id = org_id) as avg_content_length,
        (SELECT MAX(indexed_at) FROM rag_documents WHERE organization_id = org_id) as last_indexed_at;
END;
$$ LANGUAGE plpgsql STABLE;--> statement-breakpoint

-- =============================================================================
-- STEP 3: AUTOMATIC ORGANIZATION_ID POPULATION TRIGGERS
-- =============================================================================

-- Auto-populate organization_id for RAG documents from their index
CREATE OR REPLACE FUNCTION populate_rag_document_organization_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-populate organization_id from the rag_index
    IF NEW.organization_id IS NULL THEN
        SELECT organization_id INTO NEW.organization_id
        FROM rag_indexes 
        WHERE id = NEW.rag_index_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER trigger_populate_rag_document_org_id
    BEFORE INSERT ON rag_documents
    FOR EACH ROW
    EXECUTE FUNCTION populate_rag_document_organization_id();--> statement-breakpoint

-- Auto-populate organization_id for RAG query logs from their index
CREATE OR REPLACE FUNCTION populate_rag_query_log_organization_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-populate organization_id from the rag_index
    IF NEW.organization_id IS NULL THEN
        SELECT organization_id INTO NEW.organization_id
        FROM rag_indexes 
        WHERE id = NEW.rag_index_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER trigger_populate_rag_query_log_org_id
    BEFORE INSERT ON rag_query_logs
    FOR EACH ROW
    EXECUTE FUNCTION populate_rag_query_log_organization_id();--> statement-breakpoint

-- =============================================================================
-- STEP 4: RAG ANALYTICS VIEW
-- =============================================================================

-- Organization-scoped RAG analytics view with RLS support
CREATE VIEW rag_organization_analytics AS
SELECT 
    o.id as organization_id,
    o.name as organization_name,
    COUNT(DISTINCT ri.id) as total_indexes,
    COUNT(DISTINCT rd.id) as total_documents,
    COUNT(DISTINCT rql.id) as total_queries,
    AVG(rql.results_count) as avg_results_per_query,
    MAX(rql.created_at) as last_query_at,
    MAX(rd.indexed_at) as last_indexed_at
FROM organizations o
LEFT JOIN rag_indexes ri ON ri.organization_id = o.id
LEFT JOIN rag_documents rd ON rd.organization_id = o.id  
LEFT JOIN rag_query_logs rql ON rql.organization_id = o.id
WHERE o.id = get_current_organization_id()
GROUP BY o.id, o.name;--> statement-breakpoint

-- =============================================================================
-- STEP 5: GRANT PERMISSIONS
-- =============================================================================

-- Grant access to search functions
GRANT EXECUTE ON FUNCTION search_rag_documents_by_organization(integer, vector, numeric, integer) TO PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION get_rag_stats_by_organization(integer) TO PUBLIC;--> statement-breakpoint
GRANT SELECT ON rag_organization_analytics TO PUBLIC;--> statement-breakpoint

-- =============================================================================
-- STEP 6: OPTIMIZE EXISTING DATA
-- =============================================================================

-- Update statistics for query planner
ANALYZE rag_documents;--> statement-breakpoint
ANALYZE rag_query_logs;--> statement-breakpoint
ANALYZE rag_indexes;--> statement-breakpoint