Feature: RAG Service Operations
  As a system administrator or developer
  I want to manage RAG indexes and perform vector operations
  So that I can maintain and optimize the knowledge retrieval system

  Background:
    Given the PostgreSQL database is running with pgvector extension
    And the RAG service is initialized

  Scenario: RAG index creation and configuration
    Given I want to create a RAG index for my organization
    When I create an index with the following configuration:
      | Field           | Value                           |
      | name            | "Organization Knowledge Base"   |
      | organization_id | 1                              |
      | domain_types    | ["tables", "agents"]          |
      | embedding_model | "text-embedding-ada-002"       |
    Then the index should be created with a unique ID
    And the index status should be set to "building"
    And the pgvector extension should be initialized if not already done

  Scenario: Automatic table indexing with rich content
    Given I have a RAG index configured for tables
    And my organization has tables with the following structure:
      | Table Name | Fields | Organization |
      | Users      | 3      | 1           |
      | Orders     | 5      | 1           |
      | Products   | 7      | 1           |
    When the indexing process runs
    Then each table should be processed with schema information
    And embeddings should be generated for comprehensive table descriptions
    And the content should include field names, types, and relationships
    And the documents should be stored with metadata about field count and organization

  Scenario: Vector similarity search with multiple metrics
    Given I have an active RAG index with embedded documents
    When I search for "database tables with user information"
    Then the system should generate an embedding for my query
    And it should perform vector similarity search using cosine distance by default
    And I can optionally specify euclidean distance or inner product metrics
    And results should be ranked by similarity score
    And results below the threshold should be filtered out

  Scenario: Batch processing for large datasets
    Given my organization has 50 tables with many fields
    When the RAG indexing process runs
    Then tables should be processed in batches of 10
    And embeddings should be generated in parallel for performance
    And the system should track progress and handle errors gracefully
    And the final document count should match the number of processed tables

  Scenario: RAG index cleanup and management
    Given I have multiple RAG indexes in the system
    When I delete a RAG index
    Then all associated documents should be removed from rag_documents
    And all query logs should be removed from rag_query_logs
    And the index record should be removed from rag_indexes
    And no orphaned data should remain in the system

  Scenario: Query performance with vector indexes
    Given the RAG system has created vector indexes in PostgreSQL
    When I perform similarity searches
    Then queries should use the IVFFlat indexes for optimization
    And searches should complete in reasonable time even with large datasets
    And the system should support both cosine and L2 distance indexes

  Scenario: Domain filtering and scoping
    Given I create a RAG index with domain_types ["tables"]
    When the indexing process runs
    Then only table data should be indexed
    And agent data should be skipped
    And file and workflow data should be ignored
    And the document count should reflect only the included domain types

  Scenario: Error handling and recovery
    Given the embedding generation fails for some documents
    When the indexing process encounters errors
    Then the index status should be set to "error"
    And partial results should not corrupt the index
    And the system should provide detailed error information
    And the indexing can be retried without data corruption

  Scenario: Multi-organization data isolation
    Given I have indexes for multiple organizations
    When I search within organization 1
    Then results should only include data from organization 1
    And data from organization 2 should never appear in results
    And the vector search should respect organization boundaries
    And cross-organization data leakage should be prevented