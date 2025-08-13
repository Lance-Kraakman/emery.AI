Feature: RAG-Enhanced Chat System
  As a user of the Emery platform
  I want to chat with an AI assistant that has knowledge of my organization's data
  So that I can get accurate, context-aware responses about my tables, workflows, and other resources

  Background:
    Given I am authenticated as a user
    And my organization has existing tables and data
    And the RAG system is enabled with pgvector

  Scenario: Basic chat functionality without RAG context
    Given I navigate to the mission control chat
    When I send a message "Hello, how are you?"
    Then I should receive a streaming response from the AI assistant
    And the response should be conversational and helpful

  Scenario: Chat with automatic RAG context injection
    Given my organization has tables named "Users" and "Orders" 
    And the tables contain structured data with defined fields
    When I send a message "What tables do we have in our system?"
    Then the system should automatically create a RAG index if none exists
    And the system should search for relevant organizational context
    And I should receive a response mentioning specific table names and structures
    And the response should include organizational context from the RAG system

  Scenario: RAG system handles organization scoping
    Given I belong to organization "Acme Corp"
    And there are other organizations with their own tables
    When I ask about tables in the chat
    Then the RAG system should only search within my organization's data
    And the response should not include information from other organizations

  Scenario: Vector similarity search with table schemas
    Given my organization has a table called "ProductCatalog" with fields:
      | Field Name | Type     | Description          |
      | id         | number   | Product identifier   |
      | name       | text     | Product name         |
      | price      | number   | Product price        |
      | category   | relation | Links to Categories  |
    When I ask "Tell me about our product catalog structure"
    Then the RAG system should use vector similarity search
    And the response should describe the ProductCatalog table structure
    And the response should mention the field types and relationships

  Scenario: Fallback to text search when vector operations fail
    Given the pgvector extension encounters an error
    When I send a message requiring organizational context
    Then the system should gracefully fall back to text-based search
    And I should still receive relevant responses about my organization's data
    And no errors should be shown to the user

  Scenario: OpenAI API key configuration
    Given the OPENAI_API_KEY environment variable is not set
    When I try to send a chat message
    Then I should receive an error message about missing API key configuration
    And the error should provide clear instructions for setting up the API key

  Scenario: RAG index management and performance
    Given I have a large organization with many tables
    When the system creates a RAG index
    Then it should process tables in batches for performance
    And it should generate embeddings for table schema content
    And the index status should be tracked as "building" then "active"
    And query performance should be optimized with vector indexes

  Scenario: Multiple similarity metrics support
    Given the RAG system is configured
    When vector similarity searches are performed
    Then the system should support cosine distance by default
    And it should also support euclidean distance and inner product metrics
    And similarity scores should be properly normalized and filtered by threshold

  Scenario: Real-time streaming responses
    Given I send a message that requires RAG context
    When the AI generates a response
    Then the response should stream in real-time character by character
    And I should see the text appear progressively as it's generated
    And the streaming should handle errors gracefully without breaking the UI

  Scenario: Query logging and analytics
    Given the RAG system is active
    When I perform searches through the chat interface
    Then each query should be logged with metadata including:
      | Field           | Purpose                    |
      | query           | The user's question        |
      | results_count   | Number of results found    |
      | similarity_metric | Which distance function used |
      | user_id         | Who performed the query    |
      | session_id      | Chat session identifier   |
    And this data should be available for analytics and system improvement