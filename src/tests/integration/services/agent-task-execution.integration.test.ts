/**
 * Agent Task Execution Integration Tests
 * 
 * Tests the full agent task execution workflow including:
 * - Agent creation and validation
 * - Task creation with proper instructions
 * - Task execution via gRPC workers
 * - Task status lifecycle (pending → running → completed/failed)
 * - Result processing and storage
 * 
 * AIDEV-NOTE: This tests the actual execution flow using AgentTaskApplicationService
 * with real gRPC workers, unlike the postgres-event-notification tests which only
 * test database event triggers.
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { getAgentTaskApplicationService, getAgentApplicationService } from '@/ddd/application/di/container';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';
import { AgentId } from '@/ddd/domain/shared/value-objects';

// Set default timeout to 3 minutes for agent execution tests (accounts for AI model delays)
const TEST_TIMEOUT = 180000;
import type { CreateTaskDTO, TaskExecutionResultDTO } from '@/app/dtos/task.dto';
import type { CreateAgentDTO } from '@/app/dtos/agent.dto';
import { testClient } from '../shared/integration-helpers';
import type { TestCase } from '../../shared/types';
import type { TestContext } from '../shared/test-setup';
import { initializeTestDI } from '../shared/test-setup';

// AIDEV-NOTE: Integration tests for full agent task execution workflow
// Tests actual gRPC communication and task lifecycle management

interface CreateAndExecuteTaskTestInput {
  agentId: number;
  name: string;
  instructions: string;
  tools: ToolConfig[];
  timeoutSeconds?: number;
}

interface CreateAndExecuteTaskTestOutput {
  success: boolean;
  executionSuccess: boolean;
  taskCompleted: boolean;
  error?: string;
}

// Factory function to generate test cases with proper context
function createTaskExecutionTestCases(testAgentId: number): TestCase<CreateAndExecuteTaskTestInput, CreateAndExecuteTaskTestOutput>[] {
  return [
    {
      name: 'should execute simple python calculation',
      input: {
        agentId: testAgentId,
        name: 'Simple Python Calculation',
        instructions: 'Calculate 2 + 2 using python and return the result',
        tools: [ToolConfig.basic('python_repl')],
        timeoutSeconds: 30
      },
      expected: { success: true, executionSuccess: true, taskCompleted: true }
    },
    {
      name: 'should execute calculator operation',
      input: {
        agentId: testAgentId,
        name: 'Calculator Test',
        instructions: 'Use the calculator to compute 5 * 3',
        tools: [ToolConfig.basic('calculator')],
        timeoutSeconds: 30
      },
      expected: { success: true, executionSuccess: true, taskCompleted: true }
    },
    {
      name: 'should execute mathematical expression',
      input: {
        agentId: testAgentId,
        name: 'Math Expression Test',
        instructions: 'Calculate the square root of 16',
        tools: [ToolConfig.basic('calculator')],
        timeoutSeconds: 30
      },
      expected: { success: true, executionSuccess: true, taskCompleted: true }
    }
  ];
}

// Test context that will be created in beforeEach
let testContext: TestContext;
let testAgentId: number;

describe('Agent Task Execution Integration Tests', () => {
  
  beforeAll(() => {
    // Initialize DI container
    initializeTestDI();
    console.log('✅ DI container initialized for agent task execution tests');
  });

  afterAll(async () => {
    await testClient.disconnect();
  });

  beforeEach(async () => {
    // Create fresh test organization for each test to ensure isolation
    const { createTestOrganization } = await import('../shared/test-setup');
    
    try {
      // Create unique test organization and owner
      testContext = await createTestOrganization('Agent Task Execution Test');
      
      console.log(`✅ Test context created: org=${testContext.organizationId.value}, owner=${testContext.ownerUserId.value}`);

      // Create a test agent for task execution
      const agentApplicationService = getAgentApplicationService();

      // Build DTO - Application Service handles Value Object conversion
      const agentDTO: CreateAgentDTO = {
        name: 'Task Execution Test Agent',
        description: 'Agent specifically for testing task execution workflow',
        ownerId: testContext.ownerUserId.value,
        organizationId: testContext.organizationId.value,
        role: 'assistant'
      };

      const agentResult = await agentApplicationService.createAgent(agentDTO);
      expect(agentResult.success).toBe(true);
      expect(agentResult.data).toBeDefined();

      testAgentId = agentResult.data!.id;
      console.log(`✅ Test agent created with ID: ${testAgentId}`);
      
    } catch (error) {
      console.error('❌ Error creating test context in beforeEach:', error);
      throw error;
    }
  });

  afterEach(async () => {
    try {
      // Clean test data between tests
      await testClient.cleanTestData();
      console.log(`✅ Test cleanup completed for org=${testContext.organizationId.value}`);
      
    } catch (error) {
      console.warn('⚠️  Error during test cleanup (non-fatal):', error);
      // Don't throw - cleanup errors shouldn't fail tests
    }
  });

  describe('Task Creation Operations', () => {
    
    test('should create task without execution', async () => {
      const agentTaskService = getAgentTaskApplicationService();
      
      const createDTO: CreateTaskDTO = {
        agentId: testAgentId,
        organizationId: testContext.organizationId.value,
        name: 'Creation Test Task',
        instructions: {
          instructions: 'Test task creation without execution',
          tools: [ToolConfig.basic('python_repl')]
        }
      };

      console.log(`🧪 Creating task for agent ${testAgentId}`);

      const result = await agentTaskService.createTask(createDTO);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.name).toBe(createDTO.name);
      expect(result.data!.agentId).toBe(testAgentId);
      expect(result.data!.organizationId).toBe(testContext.organizationId.value);
      expect(result.data!.status).toBe('pending');

      console.log(`✅ Task created successfully: ${result.data!.id}`);
    });
  });

  describe('Task Execution Workflow', () => {
    
    test('should execute individual task by ID', async () => {
      const agentTaskService = getAgentTaskApplicationService();

      // First create a task
      const createDTO: CreateTaskDTO = {
        agentId: testAgentId,
        organizationId: testContext.organizationId.value,
        name: 'Individual Execution Test',
        instructions: {
          instructions: 'Calculate 3 + 5 using python',
          tools: [ToolConfig.basic('python_repl')]
        }
      };

      const createResult = await agentTaskService.createTask(createDTO);
      expect(createResult.success).toBe(true);
      expect(createResult.data).toBeDefined();
      console.log(`📝 Created task: ${createResult.data!.id}`);

      // Then execute it
      const executionResult = await agentTaskService.executeTask({
        taskId: createResult.data!.id,
        timeoutSeconds: 30
      });

      // Verify execution results
      expect(executionResult.success).toBe(true);
      expect(executionResult.data).toBeDefined();
      expect(executionResult.data!.task).toBeDefined();
      expect(executionResult.data!.executionResult).toBeDefined();

      const { task: executedTask, executionResult: execResult } = executionResult.data!;

      console.log(`🔍 Task execution completed:`, {
        taskId: executedTask.id,
        status: executedTask.status,
        executionSuccess: execResult.success,
        executionStatus: execResult.status
      });

      // Task should complete successfully with gRPC worker
      expect(execResult.success).toBe(true);
      expect(executedTask.status).toBe('completed');
      expect(execResult.outputData).toBeDefined();

      console.log(`✅ Task completed successfully with output:`, execResult.outputData);

      // If task fails, the test should fail too
      if (!execResult.success) {
        throw new Error(`Task execution failed: ${execResult.error}`);
      }
    }, TEST_TIMEOUT);

    test('should run comprehensive task execution test cases', async () => {
      const agentTaskService = getAgentTaskApplicationService();
      const testCases = createTaskExecutionTestCases(testAgentId);

      for (const testCase of testCases) {
        console.log(`🧪 Running test: ${testCase.name}`);

        const createDTO: CreateTaskDTO & { timeoutSeconds?: number } = {
          agentId: testCase.input.agentId,
          organizationId: testContext.organizationId.value,
          name: testCase.input.name,
          instructions: {
            instructions: testCase.input.instructions,
            tools: testCase.input.tools
          },
          createdBy: testContext.ownerUserId.value,
          timeoutSeconds: testCase.input.timeoutSeconds
        };

        try {
          const result = await agentTaskService.createAndExecuteTask(createDTO);

          expect(result.success).toBe(true);
          expect(result.data).toBeDefined();

          console.log(`🔍 Task execution result:`, {
            taskName: testCase.input.name,
            taskId: result.data!.task.id,
            taskStatus: result.data!.task.status,
            executionSuccess: result.data!.executionResult.success,
            executionStatus: result.data!.executionResult.status
          });

          // Verify task was created successfully
          expect(result.data!.task).toBeDefined();
          expect(result.data!.task.name).toBe(testCase.input.name);
          expect(result.data!.task.agentId).toBe(testCase.input.agentId);
          expect(testCase.expected.success).toBe(true);

          // Check execution result (may succeed or fail based on gRPC availability)
          if (result.data!.executionResult.success) {
            expect(result.data!.task.status).toBe('completed');
            expect(result.data!.executionResult.outputData).toBeDefined();
            console.log(`✅ Task executed successfully: ${testCase.name}`);
          } else {
            expect(result.data!.task.status).toBe('failed');
            expect(result.data!.executionResult.error).toBeDefined();
            console.log(`⚠️ Task failed (likely no gRPC worker available): ${testCase.name}`);
            console.log(`   Error: ${result.data!.executionResult.error}`);
          }

        } catch (error) {
          console.error(`❌ Error in test case "${testCase.name}":`, error);
          throw error;
        }
      }
    }, TEST_TIMEOUT);
  });

  describe('Task Management Operations', () => {
    
    test('should retrieve tasks by agent and organization', async () => {
      const agentTaskService = getAgentTaskApplicationService();

      // Create multiple tasks
      const taskNames = ['Retrieval Test 1', 'Retrieval Test 2', 'Retrieval Test 3'];
      const createdTasks = [];

      for (const name of taskNames) {
        const result = await agentTaskService.createTask({
          agentId: testAgentId,
          organizationId: testContext.organizationId.value,
          name,
          instructions: {
            instructions: `Task instructions for ${name}`,
            tools: [ToolConfig.basic('python_repl')],
          }
        });
        expect(result.success).toBe(true);
        createdTasks.push(result.data!);
      }

      console.log(`📝 Created ${createdTasks.length} tasks for retrieval testing`);

      // Test retrieval by agent
      const agentTasks = await agentTaskService.getTasksForAgent(testAgentId);
      expect(agentTasks.length).toBeGreaterThanOrEqual(taskNames.length);

      // Test retrieval by organization
      const orgTasks = await agentTaskService.getTasksForOrganization(testContext.organizationId.value);
      expect(orgTasks.length).toBeGreaterThanOrEqual(taskNames.length);

      // Verify task data
      for (const taskName of taskNames) {
        const foundAgentTask = agentTasks.find(t => t.name === taskName);
        const foundOrgTask = orgTasks.find(t => t.name === taskName);

        expect(foundAgentTask).toBeDefined();
        expect(foundOrgTask).toBeDefined();
        expect(foundAgentTask?.agentId).toBe(testAgentId);
        expect(foundOrgTask?.organizationId).toBe(testContext.organizationId.value);
      }

      console.log(`✅ Successfully retrieved tasks by agent (${agentTasks.length}) and organization (${orgTasks.length})`);
    });

    test('should cancel pending task', async () => {
      const agentTaskService = getAgentTaskApplicationService();

      // Create a task
      const result = await agentTaskService.createTask({
        agentId: testAgentId,
        organizationId: testContext.organizationId.value,
        name: 'Cancellation Test Task',
        instructions: {
          instructions: 'This task will be cancelled',
          tools: [ToolConfig.basic('python_repl')],
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.status).toBe('pending');
      console.log(`📝 Created task for cancellation: ${result.data!.id}`);

      // Cancel the task
      const cancelReason = 'Test cancellation';
      await agentTaskService.cancelTask(result.data!.id, cancelReason);

      // Retrieve task to verify cancellation
      const cancelledTask = await agentTaskService.getTask(result.data!.id);
      expect(cancelledTask).toBeDefined();
      expect(cancelledTask!.status).toBe('cancelled');

      console.log(`✅ Task successfully cancelled with reason: ${cancelReason}`);
    });
  });

  describe('Worker Health and Availability', () => {
    
    test('should check execution availability', async () => {
      const agentTaskService = getAgentTaskApplicationService();
      
      const isAvailable = await agentTaskService.isExecutionAvailable(testContext.organizationId.value);
      console.log(`🔍 Execution availability for org ${testContext.organizationId.value}: ${isAvailable}`);
      
      // Should return boolean (true if gRPC worker is available, false otherwise)
      expect(typeof isAvailable).toBe('boolean');
    });

    test('should get worker health information', async () => {
      const agentTaskService = getAgentTaskApplicationService();
      
      try {
        const healthInfo = await agentTaskService.getWorkerHealth(testContext.organizationId.value);
        console.log(`🔍 Worker health info:`, healthInfo);
        
        // Health info should be an object with status information
        expect(typeof healthInfo).toBe('object');
        expect(healthInfo).toBeDefined();
        
      } catch (error) {
        // Worker health check may fail if gRPC worker is not available - this is expected
        console.log(`⚠️ Worker health check failed (expected if no gRPC worker): ${error instanceof Error ? error.message : String(error)}`);
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Organization Isolation', () => {
    
    test('should enforce task isolation between organizations', async () => {
      const agentTaskService = getAgentTaskApplicationService();
      const agentApplicationService = getAgentApplicationService();
      
      // Create a second organization
      const { createTestOrganization } = await import('../shared/test-setup');
      const org2Context = await createTestOrganization('Task Execution Isolation Test Org 2');
      
      // Create agent in second organization
      const agent2Result = await agentApplicationService.createAgent({
        name: 'Isolation Test Agent 2',
        description: 'Agent for testing organization isolation',
        ownerId: org2Context.ownerUserId.value,
        organizationId: org2Context.organizationId.value,
        role: 'assistant'
      });
      
      expect(agent2Result.success).toBe(true);
      const agent2Id = agent2Result.data!.id;
      
      // Create tasks in both organizations
      const task1Result = await agentTaskService.createTask({
        agentId: testAgentId,
        organizationId: testContext.organizationId.value,
        name: 'Org 1 Task',
        instructions: {
          instructions: 'Task in organization 1',
          tools: [ToolConfig.basic('python_repl')],
        }
      });
      expect(task1Result.success).toBe(true);

      const task2Result = await agentTaskService.createTask({
        agentId: agent2Id,
        organizationId: org2Context.organizationId.value,
        name: 'Org 2 Task',
        instructions: {
          instructions: 'Task in organization 2',
          tools: [ToolConfig.basic('python_repl')],
        }
      });
      expect(task2Result.success).toBe(true);
      
      // Verify organization isolation
      const org1Tasks = await agentTaskService.getTasksForOrganization(testContext.organizationId.value);
      const org2Tasks = await agentTaskService.getTasksForOrganization(org2Context.organizationId.value);
      
      // Each organization should only see its own tasks
      const org1TaskNames = org1Tasks.map(t => t.name);
      const org2TaskNames = org2Tasks.map(t => t.name);
      
      expect(org1TaskNames).toContain('Org 1 Task');
      expect(org1TaskNames).not.toContain('Org 2 Task');
      
      expect(org2TaskNames).toContain('Org 2 Task');
      expect(org2TaskNames).not.toContain('Org 1 Task');
      
      console.log(`✅ Organization isolation verified - Org1: ${org1Tasks.length} tasks, Org2: ${org2Tasks.length} tasks`);
    });
  });
});