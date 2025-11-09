/**
 * PostgreSQL Event Notification Integration Tests
 * 
 * Tests the event-driven scheduler architecture, specifically validating that:
 * - Database triggers fire correctly on task creation
 * - Notifications are sent to the correct 'task_event' channel
 * - Event payloads contain proper task metadata
 * - Events are received immediately (not on polling cycles)
 * 
 * AIDEV-NOTE: This validates the channel alignment fix from manual_task_created → task_event
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import postgres from 'postgres';
import { taskSchedulingContainer } from '@/ddd/application/di/scheduling-container';
import { getAgentApplicationService, getAgentTaskApplicationService } from '@/ddd/application/di/container';
import { testClient } from '../shared/integration-helpers';
import type { TestContext } from '../shared/test-setup';
import { initializeTestDI } from '../shared/test-setup';
import { contextAwareDb } from '@/lib/db/simple-context-proxy';
import { rawClient } from '@/lib/db/client';
import { contextManager } from '@/lib/db/context-manager';
import { AgentId } from '@/ddd/domain/shared/value-objects';

describe('PostgreSQL Event Notification Integration Tests', () => {
  let testContext: TestContext;
  let testAgentId: AgentId;

  beforeAll(() => {
    // Initialize DI containers for testing
    initializeTestDI();
    taskSchedulingContainer.initialize(contextAwareDb, rawClient);
    console.log('✅ DI containers initialized for event notification tests');
  });

  beforeEach(async () => {
    // Create fresh test organization for each test to ensure isolation
    const { createTestOrganization } = await import('../shared/test-setup');
    
    try {
      testContext = await createTestOrganization('Event Test Organization');
      
      // Create a test agent for task scheduling
      const agentService = getAgentApplicationService();
      const agentResult = await agentService.createAgent({
        name: 'Event Test Agent',
        description: 'Agent for testing event notifications',
        ownerId: testContext.ownerUserId.value,
        organizationId: testContext.organizationId.value,
        role: 'assistant'
      });

      if (agentResult.success && agentResult.data) {
        testAgentId = AgentId.fromNumber(agentResult.data.id);
        console.log(`✅ Test agent created: id=${testAgentId.value}`);
      } else {
        throw new Error('Failed to create test agent');
      }
      
      // Set organizational context for all subsequent operations in this test
      contextManager.setContext(testContext.organizationId, testContext.ownerUserId);
      console.log(`✅ Event test context created: org=${testContext.organizationId.value}, owner=${testContext.ownerUserId.value}`);
      console.log(`🔐 RLS context set for organization ${testContext.organizationId.value}`);
      
    } catch (error) {
      console.error('❌ Error creating event test context in beforeEach:', error);
      throw error;
    }
  });

  afterEach(async () => {
    try {
      // Clear RLS context
      contextManager.clearContext();
      
      // Clean test data between tests
      await testClient.cleanTestData();
      
      console.log(`✅ Event test cleanup completed for org=${testContext.organizationId.value}`);
      
    } catch (error) {
      console.warn('⚠️  Error during event test cleanup (non-fatal):', error);
    }
  });

  describe('Database Trigger Event Notifications', () => {
    
    test('should send task_event notification when task is created', async () => {
      // AIDEV-NOTE: Use same database URL that application services use
      // This ensures LISTEN and INSERT operations are on the same database
      const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:integration_test_password@localhost:5436/emery_integration_test';
      
      // Set up PostgreSQL listener for task_event channel
      const listener = postgres(databaseUrl);
      const eventPromise = new Promise((resolve) => {
        listener.listen('task_event', (payload) => {
          console.log(`🔔 Received task_event notification: ${payload}`);
          resolve(JSON.parse(payload));
        });
      });

      try {
        console.log(`🧪 Testing task_event notification for org ${testContext.organizationId.value}`);

        // Create task via application service - RLS context already set in beforeEach
        const agentTaskService = getAgentTaskApplicationService();
        const result = await agentTaskService.createTask({
          agentId: testAgentId.value,
          organizationId: testContext.organizationId.value,
          name: 'Event Trigger Test Task',
          instructions: {
            task: 'Test event notification system',
            tools: [],
          }
        });
        expect(result.success).toBe(true);
        const taskId = result.data!.id;

        console.log(`📝 Task created with ID: ${taskId}`);

        // Wait for event notification (should be immediate)
        const eventPayload = await Promise.race([
          eventPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Event timeout after 5 seconds')), 5000)
          )
        ]) as any;

        // Verify event notification structure matches our channel fix
        expect(eventPayload.event_type).toBe('task_created');
        expect(eventPayload.taskId).toBe(taskId);
        expect(eventPayload.agentId).toBe(testAgentId.value);
        expect(eventPayload.organizationId).toBe(testContext.organizationId.value);
        expect(eventPayload.instructions).toBe('Test event notification system');
        expect(Array.isArray(eventPayload.tools)).toBe(true);
        expect(Array.isArray(eventPayload.servers)).toBe(true);
        expect(eventPayload.userId).toBeDefined();

        console.log(`✅ Event notification validated successfully`);

      } finally {
        await listener.end();
      }
    });

    test('should handle concurrent task event notifications', async () => {
      const eventCount = 3; // Keep reasonable for test stability
      const receivedEvents: any[] = [];
      
      // AIDEV-NOTE: Use same database URL that application services use
      const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:integration_test_password@localhost:5436/emery_integration_test';
      
      // Set up listener for multiple events
      const listener = postgres(databaseUrl);
      const allEventsPromise = new Promise((resolve) => {
        listener.listen('task_event', (payload) => {
          const eventData = JSON.parse(payload);
          console.log(`🔔 Received concurrent event ${receivedEvents.length + 1}/${eventCount}: task ${eventData.taskId}`);
          receivedEvents.push(eventData);
          
          if (receivedEvents.length === eventCount) {
            resolve(receivedEvents);
          }
        });
      });

      try {
        console.log(`🧪 Testing ${eventCount} concurrent event notifications`);

        // Create multiple tasks concurrently - RLS context already set in beforeEach
        const agentTaskService = getAgentTaskApplicationService();
        const taskPromises = Array.from({ length: eventCount }, (_, i) =>
          agentTaskService.createTask({
            agentId: testAgentId.value,
            organizationId: testContext.organizationId.value,
            name: `Concurrent Event Test ${i + 1}`,
            instructions: {
              task: `Concurrent test task ${i + 1}`,
              tools: [],
              }
          })
        );

        const results = await Promise.all(taskPromises);
        results.forEach(result => expect(result.success).toBe(true));
        const taskIds = results.map(result => result.data!.id);
        console.log(`📝 Created ${taskIds.length} concurrent tasks`);

        // Wait for all events (with timeout)
        const events = await Promise.race([
          allEventsPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout waiting for ${eventCount} events`)), 10000)
          )
        ]) as any[];

        // Verify all events received
        expect(events).toHaveLength(eventCount);

        const eventTaskIds = events.map(e => e.taskId);
        const expectedTaskIds = taskIds; // taskIds is already string[]

        // Check each expected task ID was notified
        expectedTaskIds.forEach(taskId => {
          expect(eventTaskIds).toContain(taskId);
        });

        // Verify all events are for the same organization
        events.forEach(event => {
          expect(event.organizationId).toBe(testContext.organizationId.value);
          expect(event.event_type).toBe('task_created');
        });

        console.log(`✅ All ${eventCount} concurrent events validated successfully`);

      } finally {
        await listener.end();
      }
    });
  });

  describe('API Endpoint Event Triggers', () => {
    
    test('should send event when using manual trigger API endpoint', async () => {
      // AIDEV-NOTE: Use same database URL that application services use
      const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:integration_test_password@localhost:5436/emery_integration_test';
      
      // Set up PostgreSQL listener
      const listener = postgres(databaseUrl);
      const eventPromise = new Promise((resolve) => {
        listener.listen('task_event', (payload) => {
          console.log(`🔔 Received API trigger event: ${payload}`);
          resolve(JSON.parse(payload));
        });
      });

      try {
        console.log(`🧪 Testing API endpoint trigger for org ${testContext.organizationId.value}`);

        // Use test API endpoint to trigger event (validates our channel fix in the API)
        const response = await testClient.post('/api/test-manual-trigger', {
          agentId: testAgentId,
          task: 'API endpoint trigger test'
        });

        expect(response.success).toBe(true);
        expect(response.data.success).toBe(true);
        // API endpoint message doesn't need to match exactly, just verify success
        expect(response.data.message).toBeDefined();

        // Wait for event notification
        const eventPayload = await Promise.race([
          eventPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('API event timeout after 5 seconds')), 5000)
          )
        ]) as any;

        // Verify event structure from API endpoint
        expect(eventPayload.event_type).toBe('task_created');
        expect(eventPayload.agentId).toBe(testAgentId.value);
        expect(eventPayload.instructions).toBe('API endpoint trigger test');
        expect(eventPayload.userId).toBe('test-user-123');

        console.log(`✅ API endpoint event notification validated successfully`);

      } finally {
        await listener.end();
      }
    });
  });

  describe('Event Timing and Performance', () => {
    
    test('should receive events immediately, not on polling cycle', async () => {
      const startTime = Date.now();
      
      // AIDEV-NOTE: Use same database URL that application services use  
      const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:integration_test_password@localhost:5436/emery_integration_test';
      
      // Set up listener with timing
      const listener = postgres(databaseUrl);
      const eventPromise = new Promise((resolve) => {
        listener.listen('task_event', (payload) => {
          const eventTime = Date.now();
          const responseTime = eventTime - startTime;
          console.log(`⚡ Event received in ${responseTime}ms`);
          resolve(responseTime);
        });
      });

      try {
        console.log(`🧪 Testing event timing (should be immediate, not 30s polling)`);

        // Create task - RLS context already set in beforeEach
        const agentTaskService = getAgentTaskApplicationService();
        const result = await agentTaskService.createTask({
          agentId: testAgentId.value,
          organizationId: testContext.organizationId.value,
          name: 'Event Timing Test',
          instructions: {
            task: 'Test immediate event notification',
            tools: [],
          }
        });
        expect(result.success).toBe(true);

        const responseTime = await Promise.race([
          eventPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timing test timeout')), 5000)
          )
        ]) as number;
        
        // Event should arrive within milliseconds, definitely not 30 seconds (scheduler polling interval)
        expect(responseTime).toBeLessThan(2000); // Less than 2 seconds for safety
        
        console.log(`✅ Event timing validated: ${responseTime}ms (well under 30s polling interval)`);

      } finally {
        await listener.end();
      }
    });
  });
});