// AIDEV-NOTE: Integration tests for RAG Indexing Domain Service
// Tests core indexing functionality at the highest level

import { expect, test, describe, beforeAll, afterEach } from 'vitest';
import { 
  contextManager
} from '@/src/ddd/application/di/container';
import { initializeTestDI } from '../shared/test-setup';
import { testClient } from '../shared/integration-helpers';
import { createTestOrganization, type TestContext } from '../shared/test-setup';
import { RagIndex } from '@/src/ddd/domain/rag/entities';
import { RagIndexId } from '@/src/ddd/domain/rag/value-objects';

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
});