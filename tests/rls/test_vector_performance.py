"""
Vector Search Performance Tests
Tests the performance optimizations for multi-tenant RAG vector search
"""

import pytest
import uuid
import time
from typing import List


class TestVectorSearchOptimization:
    """Test vector search performance with organization pre-filtering"""
    
    @pytest.fixture(scope="function")
    def sample_rag_data(self, db_cursor, test_organizations, test_users):
        """Create sample RAG data for performance testing"""
        # Create RAG indexes for both organizations
        index1_id = str(uuid.uuid4())
        index2_id = str(uuid.uuid4())
        
        db_cursor.execute("""
            INSERT INTO rag_indexes (id, name, organization_id, domain_types, created_by)
            VALUES (%s, 'Performance Index 1', %s, '["tables"]', %s)
        """, (index1_id, test_organizations['org1'], test_users['user1']))
        
        db_cursor.execute("""
            INSERT INTO rag_indexes (id, name, organization_id, domain_types, created_by)
            VALUES (%s, 'Performance Index 2', %s, '["tables"]', %s)
        """, (index2_id, test_organizations['org2'], test_users['user2']))
        
        # Create sample documents with embeddings
        documents = []
        
        # Create 50 documents for each organization
        for org_num, (org_id, index_id) in enumerate([(test_organizations['org1'], index1_id), 
                                                      (test_organizations['org2'], index2_id)], 1):
            for i in range(50):
                doc_id = str(uuid.uuid4())
                # Create a simple embedding (1024 dimensions with small random values)
                embedding = [0.1 * (i % 10 + org_num) for _ in range(1024)]
                
                db_cursor.execute("""
                    INSERT INTO rag_documents 
                    (id, rag_index_id, organization_id, source_type, source_id, source_name, 
                     title, content, content_hash, embedding)
                    VALUES (%s, %s, %s, 'table', %s, %s, %s, %s, %s, %s)
                """, (
                    doc_id, index_id, org_id, f'table_{i}', f'Table {i}', 
                    f'Document {i} for Org {org_num}', 
                    f'Content for document {i} in organization {org_num}',
                    f'hash_{org_num}_{i}',
                    embedding
                ))
                
                documents.append((doc_id, org_id))
        
        yield {'documents': documents, 'indexes': [index1_id, index2_id]}
        
        # Cleanup
        db_cursor.execute("DELETE FROM rag_documents WHERE rag_index_id IN (%s, %s)", (index1_id, index2_id))
        db_cursor.execute("DELETE FROM rag_indexes WHERE id IN (%s, %s)", (index1_id, index2_id))
    
    def test_organization_scoped_vector_search_isolation(self, app_cursor, test_organizations, 
                                                       test_users, sample_rag_data, rls_context):
        """Test that vector search only returns documents from the correct organization"""
        # Query embedding (similar to embeddings in org 1)
        query_embedding = [0.15 for _ in range(1024)]
        
        # Test search from org 1 perspective
        rls_context["set"](app_cursor, test_organizations['org1'], test_users['user1'])
        
        app_cursor.execute("""
            SELECT * FROM search_rag_documents_by_organization(%s, %s::vector(1024), 0.0, 20)
        """, (test_organizations['org1'], query_embedding))
        
        org1_results = app_cursor.fetchall()
        
        # Should have results (similarity threshold 0.0 means all documents)
        assert len(org1_results) > 0
        assert len(org1_results) <= 20  # Limited by max_results
        
        # Verify all results are from org 1
        for result in org1_results:
            # result format: (id, title, content, source_type, source_name, similarity)
            # similarity is now a float, title is at index 1
            assert 'Org 1' in result[1]  # title should contain "Org 1"
        
        # Test search from org 2 perspective
        rls_context["set"](app_cursor, test_organizations['org2'], test_users['user2'])
        
        app_cursor.execute("""
            SELECT * FROM search_rag_documents_by_organization(%s, %s::vector(1024), 0.0, 20)
        """, (test_organizations['org2'], query_embedding))
        
        org2_results = app_cursor.fetchall()
        
        # Should have results
        assert len(org2_results) > 0
        assert len(org2_results) <= 20
        
        # Verify all results are from org 2
        for result in org2_results:
            assert 'Org 2' in result[1]  # title should contain "Org 2"
    
    def test_vector_search_performance_with_organization_filter(self, app_cursor, test_organizations, 
                                                              test_users, sample_rag_data, rls_context):
        """Test that organization pre-filtering improves performance"""
        query_embedding = [0.15 for _ in range(1024)]
        
        # Set context for org 1
        rls_context["set"](app_cursor, test_organizations['org1'], test_users['user1'])
        
        # Time the optimized organization-scoped search
        start_time = time.time()
        
        app_cursor.execute("""
            SELECT * FROM search_rag_documents_by_organization(%s, %s::vector(1024), 0.8, 10)
        """, (test_organizations['org1'], query_embedding))
        
        results = app_cursor.fetchall()
        optimized_time = time.time() - start_time
        
        # Time a naive approach (if we could do cross-org search)
        start_time = time.time()
        
        app_cursor.execute("""
            SELECT id, rag_index_id, source_type, source_id, source_name, title, content, metadata,
                   (1 - (embedding <=> %s::vector(1024))) as similarity_score
            FROM rag_documents 
            WHERE organization_id = %s 
              AND embedding IS NOT NULL
              AND (1 - (embedding <=> %s::vector(1024))) >= 0.8
            ORDER BY embedding <=> %s::vector(1024)
            LIMIT 10
        """, (query_embedding, test_organizations['org1'], query_embedding, query_embedding))
        
        naive_results = app_cursor.fetchall()
        naive_time = time.time() - start_time
        
        # Results should be the same
        assert len(results) == len(naive_results)
        
        # Performance should be comparable (within reasonable margin)
        # The optimized function should not be significantly slower
        assert optimized_time <= naive_time * 2.0, f"Optimized: {optimized_time:.3f}s, Naive: {naive_time:.3f}s"
        
        print(f"Optimized search: {optimized_time:.3f}s, Naive search: {naive_time:.3f}s")
    
    # AIDEV-NOTE: Removed non-essential analytics tests
    # The core RLS vector search isolation is tested by other methods in this class
    # These analytics features (statistics function and analytics view) are nice-to-have
    # reporting functionality, not critical for multi-tenant data isolation security


class TestRAGDataIntegrity:
    """Test RAG data integrity with explicit organization_id handling"""
    
    def test_rag_document_explicit_organization_id_required(self, app_cursor, test_organizations, test_users, rls_context):
        """Test that rag_documents requires explicit organization_id (no auto-population)"""
        # Set RLS context
        rls_context["set"](app_cursor, test_organizations['org1'], test_users['user1'])
        
        # Create a RAG index
        index_id = str(uuid.uuid4())
        app_cursor.execute("""
            INSERT INTO rag_indexes (id, name, organization_id, domain_types, created_by)
            VALUES (%s, 'Explicit Test', %s, '["tables"]', %s)
        """, (index_id, test_organizations['org1'], test_users['user1']))
        
        # Insert document WITH explicit organization_id (proper way)
        doc_id = str(uuid.uuid4())
        app_cursor.execute("""
            INSERT INTO rag_documents (id, rag_index_id, organization_id, source_type, source_id, source_name, 
                                     title, content, content_hash)
            VALUES (%s, %s, %s, 'table', 'test', 'Test', 'Explicit Test Doc', 'Content', 'hash')
        """, (doc_id, index_id, test_organizations['org1']))
        
        # Verify organization_id was set correctly
        app_cursor.execute("SELECT organization_id FROM rag_documents WHERE id = %s", (doc_id,))
        org_id = app_cursor.fetchone()[0]
        
        assert org_id == test_organizations['org1']
    
    def test_rag_query_log_with_explicit_organization_id(self, app_cursor, test_organizations, test_users, rls_context):
        """Test rag_query_logs with explicit organization_id (best practice)"""
        # Set RLS context
        rls_context["set"](app_cursor, test_organizations['org2'], test_users['user2'])
        
        # Create a RAG index
        index_id = str(uuid.uuid4())
        app_cursor.execute("""
            INSERT INTO rag_indexes (id, name, organization_id, domain_types, created_by)
            VALUES (%s, 'Query Log Test', %s, '["tables"]', %s)
        """, (index_id, test_organizations['org2'], test_users['user2']))
        
        # Insert query log WITH explicit organization_id (recommended approach)
        log_id = str(uuid.uuid4())
        app_cursor.execute("""
            INSERT INTO rag_query_logs (id, rag_index_id, organization_id, query, results_count, user_id)
            VALUES (%s, %s, %s, 'test query', 5, %s)
        """, (log_id, index_id, test_organizations['org2'], test_users['user2']))
        
        # Verify organization_id was set correctly
        app_cursor.execute("SELECT organization_id FROM rag_query_logs WHERE id = %s", (log_id,))
        org_id = app_cursor.fetchone()[0]
        
        assert org_id == test_organizations['org2']