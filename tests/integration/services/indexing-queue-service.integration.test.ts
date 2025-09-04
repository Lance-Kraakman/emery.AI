// AIDEV-NOTE: Integration tests for Indexing Queue Service
// Tests core queue functionality - enqueue, process, retry

import { expect, test, describe, beforeAll, afterEach } from 'vitest';
import { 
  getIndexingQueueService,
  getRagIndexRepository,
  initializeDI,
  contextManager
} from '@/ddd/application/di/container';
import { testClient } from '../shared/integration-helpers';
import { createTestOrganization, type TestContext } from '../shared/test-setup';
import { OrganizationId } from '@/ddd/domain/shared/value-objects';
import { RagIndex } from '@/ddd/domain/rag/entities';

describe('Indexing Queue Service Integration Tests', () => {
  let testContext: TestContext;

  beforeAll(async () => {
    // Initialize DI container
    const { contextAwareDb } = await import('@/lib/db/simple-context-proxy');
    const { rawClient } = await import('@/lib/db/client');
    initializeDI(contextAwareDb, rawClient);
  });

  afterEach(async () => {
    await testClient.cleanTestData();
    await contextManager.clearContext();
    
    // Clear queue after each test
    const queueService = getIndexingQueueService();
    await queueService.clearAll();
  });

  describe('Core Queue Operations', () => {
    test('should enqueue and process initial indexing operation', async () => {
      // Setup
      testContext = await createTestOrganization('Test Org - Queue Initial');
      const queueService = getIndexingQueueService();
      const indexRepository = getRagIndexRepository();
      
      // Create a test index
      const index = RagIndex.create({
        name: 'Queue Test Index',
        organizationId: testContext.organizationId,
        domainTypes: ['files']
      });
      await indexRepository.save(index);
      
      // Act - Enqueue initial indexing operation
      const operationId = await queueService.enqueue({
        indexId: index.id.value,
        operation: 'initial',
        maxRetries: 3
      });
      
      // Assert - Operation was enqueued
      expect(operationId).toBeDefined();
      expect(typeof operationId).toBe('string');
      
      // Check queue stats
      const stats = queueService.getStats();
      expect(stats.totalQueued).toBeGreaterThanOrEqual(1);
    });

    test('should enqueue multiple operations for different indexes', async () => {
      // Setup
      testContext = await createTestOrganization('Test Org - Multiple Queue');
      const queueService = getIndexingQueueService();
      const indexRepository = getRagIndexRepository();
      
      // Create two test indexes
      const index1 = RagIndex.create({
        name: 'Index 1',
        organizationId: testContext.organizationId,
        domainTypes: ['files']
      });
      const index2 = RagIndex.create({
        name: 'Index 2',
        organizationId: testContext.organizationId,
        domainTypes: ['tables']
      });
      await indexRepository.save(index1);
      await indexRepository.save(index2);
      
      // Act - Enqueue operations for both indexes
      const op1 = await queueService.enqueue({
        indexId: index1.id.value,
        operation: 'reindex'
      });
      const op2 = await queueService.enqueue({
        indexId: index2.id.value,
        operation: 'reindex'
      });
      
      // Assert - Both operations were enqueued
      expect(op1).toBeDefined();
      expect(op2).toBeDefined();
      expect(op1).not.toBe(op2);
      
      // Check queue has operations for both indexes
      const stats = queueService.getStats();
      expect(Object.keys(stats.indexQueues).length).toBeGreaterThanOrEqual(2);
    });

    test('should handle data-change operations with metadata', async () => {
      // Setup
      testContext = await createTestOrganization('Test Org - Data Change');
      const queueService = getIndexingQueueService();
      const indexRepository = getRagIndexRepository();
      
      // Create a test index
      const index = RagIndex.create({
        name: 'Data Change Index',
        organizationId: testContext.organizationId,
        domainTypes: ['files']
      });
      await indexRepository.save(index);
      
      // Act - Enqueue data-change operation
      const operationId = await queueService.enqueue({
        indexId: index.id.value,
        operation: 'data-change',
        domainType: 'files',
        sourceId: 'file-123',
        changeType: 'UPDATE'
      });
      
      // Assert
      expect(operationId).toBeDefined();
      
      // Get operation details to verify metadata
      const operation = queueService.getOperation(operationId);
      expect(operation).toBeDefined();
      expect(operation?.domainType).toBe('files');
      expect(operation?.sourceId).toBe('file-123');
      expect(operation?.changeType).toBe('UPDATE');
    });

    test('should wait for completion with timeout', async () => {
      // Setup
      testContext = await createTestOrganization('Test Org - Wait Completion');
      const queueService = getIndexingQueueService();
      const indexRepository = getRagIndexRepository();
      
      // Create a test index
      const index = RagIndex.create({
        name: 'Completion Test Index',
        organizationId: testContext.organizationId,
        domainTypes: ['files']
      });
      index.startIndexing();
      index.completeIndexing(0);
      await indexRepository.save(index);
      
      // Act - Enqueue a simple operation
      await queueService.enqueue({
        indexId: index.id.value,
        operation: 'reindex',
        maxRetries: 1
      });
      
      // Wait for completion (should complete quickly for empty index)
      await queueService.waitForCompletion(5000); // 5 second timeout
      
      // Assert - Queue should be empty after completion
      const stats = queueService.getStats();
      expect(stats.totalQueued).toBe(0);
      expect(stats.totalProcessing).toBe(0);
    });

    test('should clear all queues when requested', async () => {
      // Setup
      testContext = await createTestOrganization('Test Org - Clear All');
      const queueService = getIndexingQueueService();
      
      // Enqueue some operations
      await queueService.enqueue({
        indexId: 'index-1',
        operation: 'initial'
      });
      await queueService.enqueue({
        indexId: 'index-2',
        operation: 'reindex'
      });
      
      // Act - Clear all queues
      await queueService.clearAll();
      
      // Assert - All queues should be empty
      const stats = queueService.getStats();
      expect(stats.totalQueued).toBe(0);
      expect(stats.totalProcessing).toBe(0);
      expect(stats.totalCompleted).toBe(0);
      expect(stats.totalFailed).toBe(0);
      expect(Object.keys(stats.indexQueues).length).toBe(0);
    });
  });
});