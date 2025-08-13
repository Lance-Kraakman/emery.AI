Feature: RAG API Endpoints
  As a developer integrating with the RAG system
  I want to use HTTP API endpoints to manage indexes and perform searches
  So that I can build applications that leverage organizational knowledge

  Background:
    Given I am authenticated with valid session credentials
    And I have access to an organization with data

  Scenario: Create RAG index via API
    When I POST to "/api/rag" with:
      """
      {
        "action": "create",
        "name": "Customer Support Knowledge",
        "description": "Index for customer support data",
        "domainTypes": ["tables", "agents"],
        "organizationId": 1
      }
      """
    Then I should receive a 201 Created response
    And the response should contain the new index ID
    And the index should be created with status "building"

  Scenario: List RAG indexes for organization
    Given my organization has 3 RAG indexes
    When I GET "/api/rag?organizationId=1"
    Then I should receive a 200 OK response
    And the response should contain an array of 3 indexes
    And each index should have fields: id, name, status, documentCount, domainTypes

  Scenario: Trigger manual reindexing
    Given I have a RAG index with ID "abc-123"
    When I POST to "/api/rag/abc-123/reindex"
    Then I should receive a 202 Accepted response
    And the index status should change to "building"
    And the reindexing should start in the background

  Scenario: Search via API endpoint
    Given I have an active RAG index with ID "abc-123"
    When I POST to "/api/rag/search" with:
      """
      {
        "indexId": "abc-123",
        "query": "user management tables",
        "limit": 5,
        "threshold": 0.7
      }
      """
    Then I should receive a 200 OK response
    And the response should contain search results with:
      | Field         | Type    | Description                    |
      | documents     | array   | Array of matching documents    |
      | totalCount    | number  | Total number of results        |
      | query         | string  | Original search query          |
    And each document should have similarity score, content, and metadata

  Scenario: Stream chat with RAG context
    Given the RAG system has organizational data indexed
    When I POST to "/api/chat/stream" with:
      """
      {
        "messages": [
          {
            "role": "user", 
            "content": "What user data do we store?"
          }
        ]
      }
      """
    Then I should receive a streaming response
    And the response headers should include "Content-Type: text/plain; charset=utf-8"
    And the stream should contain AI-generated text with organizational context
    And the response should reference specific tables and fields from my organization

  Scenario: Error handling for invalid requests
    When I POST to "/api/rag/search" with invalid JSON:
      """
      {
        "indexId": "",
        "query": ""
      }
      """
    Then I should receive a 400 Bad Request response
    And the response should contain validation error details

  Scenario: Authentication required for all endpoints
    Given I am not authenticated
    When I try to access any RAG endpoint
    Then I should receive a 401 Unauthorized response
    And I should be redirected to the authentication flow

  Scenario: Rate limiting and performance
    Given I have an active RAG index
    When I make multiple rapid search requests
    Then each request should complete within reasonable time limits
    And the system should handle concurrent requests gracefully
    And no memory leaks should occur during high load

  Scenario: CORS and security headers
    When I make a request to any RAG API endpoint
    Then the response should include appropriate security headers
    And CORS should be properly configured for the frontend domain
    And sensitive information should not be exposed in error messages