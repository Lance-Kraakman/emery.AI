-- Fix Vector Indexes for Multi-Tenant Performance
-- pgvector IVFFlat doesn't support multicolumn indexes, so we use a different strategy

-- =============================================================================
-- STEP 1: DROP FAILED MULTICOLUMN VECTOR INDEXES
-- =============================================================================

-- These failed because IVFFlat doesn't support multicolumn indexes
DROP INDEX IF EXISTS idx_rag_documents_org_embedding;
DROP INDEX IF EXISTS idx_rag_documents_org_embedding_l2;

-- =============================================================================
-- STEP 2: CREATE OPTIMIZED VECTOR SEARCH STRATEGY
-- =============================================================================

-- Strategy: Use separate B-tree index for organization filtering + vector index for similarity
-- This allows pre-filtering by organization before vector search

-- Fast organization filtering (B-tree index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rag_documents_org_id_fast 
    ON rag_documents(organization_id);

-- Separate vector indexes for similarity search within pre-filtered results
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rag_documents_embedding_cosine 
    ON rag_documents USING ivfflat (embedding vector_cosine_ops) 
    WITH (lists = 100);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rag_documents_embedding_l2 
    ON rag_documents USING ivfflat (embedding) 
    WITH (lists = 100);

-- =============================================================================
-- STEP 3: CREATE OPTIMIZED SEARCH FUNCTION
-- =============================================================================

-- Updated function that uses organization pre-filtering + vector search
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
      AND rd.embedding IS NOT NULL
      AND (1 - (rd.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY rd.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 4: CREATE PARTIAL INDEXES FOR COMMON QUERY PATTERNS
-- =============================================================================

-- Partial indexes for active documents with embeddings
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rag_documents_org_with_embedding 
    ON rag_documents(organization_id, rag_index_id) 
    WHERE embedding IS NOT NULL;

-- Index for source-type filtering within organization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rag_documents_org_source_type 
    ON rag_documents(organization_id, source_type);

-- Index for recently indexed content
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rag_documents_org_recent 
    ON rag_documents(organization_id, indexed_at DESC);

-- =============================================================================
-- STEP 5: CREATE FUNCTION FOR FAST ORGANIZATION-SCOPED VECTOR STATS
-- =============================================================================

-- Function to get vector statistics for an organization
CREATE OR REPLACE FUNCTION get_rag_stats_by_organization(org_id integer)
RETURNS TABLE (
    total_documents bigint,
    documents_with_embeddings bigint,
    avg_content_length float,
    last_indexed_at timestamp
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_documents,
        COUNT(embedding) as documents_with_embeddings,
        AVG(LENGTH(content))::float as avg_content_length,
        MAX(indexed_at) as last_indexed_at
    FROM rag_documents rd
    WHERE rd.organization_id = org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 6: OPTIMIZE QUERY PERFORMANCE WITH EXPRESSION INDEXES
-- =============================================================================

-- Index for similarity score calculation (pre-computed for frequent queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rag_documents_org_content_hash 
    ON rag_documents(organization_id, content_hash);

-- =============================================================================
-- STEP 7: GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION get_rag_stats_by_organization(integer) TO PUBLIC;

-- =============================================================================
-- STEP 8: ANALYZE FOR BETTER QUERY PLANNING
-- =============================================================================

ANALYZE rag_documents;

-- =============================================================================
-- STEP 9: CREATE VIEW FOR ORGANIZATION-SCOPED RAG ANALYTICS
-- =============================================================================

-- View for RAG analytics within organization context
CREATE OR REPLACE VIEW rag_organization_analytics AS
SELECT 
    ri.organization_id,
    ri.id as rag_index_id,
    ri.name as index_name,
    COUNT(rd.id) as document_count,
    COUNT(rd.embedding) as embedded_document_count,
    AVG(LENGTH(rd.content)) as avg_content_length,
    MAX(rd.indexed_at) as last_indexed_at,
    COUNT(DISTINCT rd.source_type) as unique_source_types
FROM rag_indexes ri
LEFT JOIN rag_documents rd ON ri.id = rd.rag_index_id
GROUP BY ri.organization_id, ri.id, ri.name;

-- Grant access to the view
GRANT SELECT ON rag_organization_analytics TO PUBLIC;