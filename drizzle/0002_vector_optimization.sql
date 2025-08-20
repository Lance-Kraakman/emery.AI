-- Vector Search Optimization for Multi-Tenant RAG
-- Essential performance optimizations only

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
    similarity double precision
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

-- =============================================================================
-- STEP 3: GRANT PERMISSIONS
-- =============================================================================

-- Grant access to search functions
GRANT EXECUTE ON FUNCTION search_rag_documents_by_organization(integer, vector, numeric, integer) TO PUBLIC;--> statement-breakpoint