// AIDEV-NOTE: Integration tests for RAG Indexing Domain Service
// Tests core indexing functionality at the highest level

import { expect, test, describe, beforeAll, afterEach } from 'vitest';
import { 
  getIndexingDomainService,
  getRagIndexRepository,
  getRagDocumentRepository,
  contextManager
} from '@/ddd/application/di/container';
import { initializeTestDI } from '../shared/test-setup';
import { testClient } from '../shared/integration-helpers';
import { createTestOrganization, type TestContext } from '../shared/test-setup';
import { RagIndex } from '@/ddd/domain/rag/entities';
import { RagIndexId } from '@/ddd/domain/rag/value-objects';

describe('RAG Indexing Domain Service Integration Tests', () => {
  let testContext: TestContext;

  beforeAll(async () => {
    // Initialize DI container
    initializeTestDI();
  });

  afterEach(async () => {
    await testClient.cleanTestData();
    await contextManager.clearContext();
  });

  describe('Core Indexing Functionality', () => {
    test('should auto-create default index when organization has no indexes', async () => {
      // Setup
      testContext = await createTestOrganization('Test Org - Auto Index');
      const indexingService = getIndexingDomainService();
      const indexRepository = getRagIndexRepository();
      const orgId = testContext.organizationId;
      
      // Verify no indexes exist initially
      const initialIndexes = await indexRepository.findByOrganization(orgId);
      expect(initialIndexes).toHaveLength(0);
      
      // Act - Call reindexData which should auto-create default index
      await indexingService.reindexData(orgId);
      
      // Assert - Default index should be created
      const indexes = await indexRepository.findByOrganization(orgId);
      expect(indexes).toHaveLength(1);
      expect(indexes[0].name).toBe('Organization Knowledge Base');
      expect(indexes[0].domainTypes).toContain('files');
      expect(indexes[0].domainTypes).toContain('tables');
      expect(indexes[0].domainTypes).toContain('agents');
    });

    test('should execute initial indexing for a new index', async () => {
      // Setup
      testContext = await createTestOrganization('Test Org - Initial Indexing');
      const indexingService = getIndexingDomainService();
      const indexRepository = getRagIndexRepository();
      
      // Create a new index
      const index = RagIndex.create({
        name: 'Test Index',
        organizationId: testContext.organizationId,
        domainTypes: ['files']
      });
      await indexRepository.save(index);
      
      // Act - Execute initial indexing
      await indexingService.executeInitialIndexing(index.id);
      
      // Assert - Index should be marked as active after indexing
      const updatedIndex = await indexRepository.findById(index.id);
      expect(updatedIndex).toBeDefined();
      expect(updatedIndex?.status).toBe('active');
    });

    test('should execute reindex for specific domain type', async () => {
      // Setup
      testContext = await createTestOrganization('Test Org - Domain Reindex');
      const indexingService = getIndexingDomainService();
      const indexRepository = getRagIndexRepository();
      const documentRepository = getRagDocumentRepository();
      
      // Create an index with multiple domain types
      const index = RagIndex.create({
        name: 'Multi-Domain Index',
        organizationId: testContext.organizationId,
        domainTypes: ['files', 'tables', 'agents']
      });
      index.startIndexing();
      index.completeIndexing(0);
      await indexRepository.save(index);
      
      // Act - Reindex only 'files' domain
      await indexingService.executeReindex(index.id, 'files');
      
      // Assert - Index should remain active
      const updatedIndex = await indexRepository.findById(index.id);
      expect(updatedIndex?.status).toBe('active');
      
      // Check that the reindex operation completed (no errors thrown)
      const documents = await documentRepository.findByIndexId(index.id);
      expect(documents).toBeDefined();
    });

    test('should handle reindex for organization with existing index', async () => {
      // Setup
      testContext = await createTestOrganization('Test Org - Org Reindex');
      const indexingService = getIndexingDomainService();
      const indexRepository = getRagIndexRepository();
      const orgId = testContext.organizationId;
      
      // Create an existing index
      const existingIndex = RagIndex.create({
        name: 'Existing Index',
        organizationId: orgId,
        domainTypes: ['files']
      });
      existingIndex.startIndexing();
      existingIndex.completeIndexing(0);
      await indexRepository.save(existingIndex);
      
      // Act - Reindex organization (should use existing index, not create new one)
      await indexingService.reindexData(orgId);
      
      // Assert - Should still have only one index
      const indexes = await indexRepository.findByOrganization(orgId);
      expect(indexes).toHaveLength(1);
      expect(indexes[0].id.value).toBe(existingIndex.id.value);
    });

    test('should handle index not found error gracefully', async () => {
      // Setup
      testContext = await createTestOrganization('Test Org - Error Handling');
      const indexingService = getIndexingDomainService();
      const fakeIndexId = '99999999-9999-9999-9999-999999999999';
      
      // Act & Assert - Should throw error for non-existent index
      const fakeIndexIdVO = RagIndexId.fromString(fakeIndexId);
      await expect(
        indexingService.executeInitialIndexing(fakeIndexIdVO)
      ).rejects.toThrow(`Index ${fakeIndexId} not found`);
    });
  });
});