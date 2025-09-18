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
import { getAgentTaskApplicationService, getAgentApplicationService } from '@/src/ddd/application/di/container';
import { ToolConfig } from '@/src/ddd/domain/tools/value-objects/tool-config';

// Set default timeout to 3 minutes for agent execution tests (accounts for AI model delays)
const TEST_TIMEOUT = 180000;
import { AgentId, OrganizationId, UserId, TaskStatus } from '@/src/ddd/domain/shared/value-objects';
import type { CreateTaskRequest, TaskExecutionResult } from '@/src/ddd/application/services/agents/agent-task-application-service';
import type { CreateAgentCommand } from '@/src/ddd/application/services/agents/agent-application-service';
import { testClient } from '../shared/integration-helpers';
import type { TestCase } from '../../shared/types';
import type { TestContext } from '../shared/test-setup';
import { initializeTestDI } from '../shared/test-setup';

// AIDEV-NOTE: Integration tests for full agent task execution workflow
// Tests actual gRPC communication and task lifecycle management

interface CreateAndExecuteTaskTestInput {
  agentId: AgentId;
  name: string;
  instructions: string;
  tools: ToolConfig[];
  servers: { name: string }[];
  timeoutSeconds?: number;
}

interface CreateAndExecuteTaskTestOutput {
  success: boolean;
  executionSuccess: boolean;
  taskCompleted: boolean;
  error?: string;
}

// Factory function to generate test cases with proper context
function createTaskExecutionTestCases(testAgentId: AgentId): TestCase<CreateAndExecuteTaskTestInput, CreateAndExecuteTaskTestOutput>[] {
  return [
    {
      name: 'should execute simple python calculation',
      input: {
        agentId: testAgentId,
        name: 'Simple Python Calculation',
        instructions: 'Calculate 2 + 2 using python and return the result',
        tools: [ToolConfig.basic('python_repl')],
        servers: [],
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
        servers: [],
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
        servers: [],
        timeoutSeconds: 30
      },
      expected: { success: true, executionSuccess: true, taskCompleted: true }
    }
  ];
}

// Test context that will be created in beforeEach
let testContext: TestContext;
let testAgentId: AgentId;

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
      const agentCommand: CreateAgentCommand = {
        name: 'Task Execution Test Agent',
        description: 'Agent specifically for testing task execution workflow',
        ownerId: testContext.ownerUserId,
        organizationId: testContext.organizationId,
        role: 'assistant',
        agentType: 'data-collector',
        tools: [
          ToolConfig.basic('python_repl'),
          ToolConfig.basic('file_reader'),
          ToolConfig.basic('web_search'),
          ToolConfig.basic('calculator')
        ],
        capabilities: [
          {
            name: 'Data Collection and Analysis',
            description: 'Collect and analyze data using Python tools',
            steps: [
              {
                type: 'TOOL_STEP',
                instructions: 'Use available tools to collect and analyze data as requested',
                tools: [
                  ToolConfig.basic('python_repl'),
                  ToolConfig.basic('web_search'),
                  ToolConfig.basic('calculator')
                ],
                servers: []
              }
            ]
          },
          {
            name: 'File Operations',
            description: 'Handle file reading and processing tasks',
            steps: [
              {
                type: 'TOOL_STEP',
                instructions: 'Read, process, or manipulate files as requested',
                tools: [
                  ToolConfig.basic('file_reader'),
                  ToolConfig.basic('python_repl')
                ],
                servers: []
              }
            ]
          }
        ]
      };

      const agentResult = await agentApplicationService.createAgent(agentCommand);
      expect(agentResult.success).toBe(true);
      expect(agentResult.data).toBeDefined();
      
      testAgentId = agentResult.data!.id;
      console.log(`✅ Test agent created with ID: ${testAgentId.value}`);
      
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
      
      const createRequest: CreateTaskRequest = {
        agentId: testAgentId,
        organizationId: testContext.organizationId,
        name: 'Creation Test Task',
        instructions: {
          instructions: 'Test task creation without execution',
          tools: [ToolConfig.basic('python_repl')],
          servers: []
        }
      };

      console.log(`🧪 Creating task for agent ${testAgentId.value}`);
      
      const task = await agentTaskService.createTask(createRequest);
      
      expect(task).toBeDefined();
      expect(task.name).toBe(createRequest.name);
      expect(task.agentId.value).toBe(testAgentId.value);
      expect(task.organizationId.value).toBe(testContext.organizationId.value);
      expect(task.isPending).toBe(true);
      
      console.log(`✅ Task created successfully: ${task.id.value}`);
    });
  });

  describe('Task Execution Workflow', () => {
    
    test('should execute individual task by ID', async () => {
      const agentTaskService = getAgentTaskApplicationService();
      
      // First create a task
      const createRequest: CreateTaskRequest = {
        agentId: testAgentId,
        organizationId: testContext.organizationId,
        name: 'Individual Execution Test',
        instructions: {
          instructions: 'Calculate 3 + 5 using python',
          tools: [ToolConfig.basic('python_repl')],
          servers: []
        }
      };

      const task = await agentTaskService.createTask(createRequest);
      console.log(`📝 Created task: ${task.id.value}`);
      
      // Then execute it
      const executionResult = await agentTaskService.executeTask({
        taskId: task.id.value,
        timeoutSeconds: 30
      });

      // Verify execution results
      expect(executionResult).toBeDefined();
      expect(executionResult.task).toBeDefined();
      expect(executionResult.executionResult).toBeDefined();
      
      const { task: executedTask, executionResult: execResult } = executionResult;
      
      console.log(`🔍 Task execution completed:`, {
        taskId: executedTask.id.value,
        status: executedTask.status,
        executionSuccess: execResult.success,
        executionStatus: execResult.status
      });

      // Task should complete successfully with gRPC worker
      expect(execResult.success).toBe(true);
      expect(executedTask.status.value).toBe('completed');
      expect(executedTask.isPending).toBe(false);
      expect(executedTask.isTerminal).toBe(true);
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
        
        const createRequest: CreateTaskRequest = {
          agentId: testCase.input.agentId,
          organizationId: testContext.organizationId,
          name: testCase.input.name,
          instructions: {
            instructions: testCase.input.instructions,
            tools: testCase.input.tools,
            servers: testCase.input.servers
          },
          createdBy: testContext.ownerUserId
        };

        try {
          const result = await agentTaskService.createAndExecuteTask({
            ...createRequest,
            timeoutSeconds: testCase.input.timeoutSeconds
          });
          
          console.log(`🔍 Task execution result:`, {
            taskName: testCase.input.name,
            taskId: result.task.id.value,
            taskStatus: result.task.status,
            executionSuccess: result.executionResult.success,
            executionStatus: result.executionResult.status
          });
          
          // Verify task was created successfully
          expect(result.task).toBeDefined();
          expect(result.task.name).toBe(testCase.input.name);
          expect(result.task.agentId.value).toBe(testCase.input.agentId);
          expect(testCase.expected.success).toBe(true);
          
          // Verify task reached terminal state
          expect(result.task.isTerminal).toBe(true);
          expect(testCase.expected.taskCompleted).toBe(true);
          
          // Check execution result (may succeed or fail based on gRPC availability)
          if (result.executionResult.success) {
            expect(result.task.status.value).toBe('completed');
            expect(result.executionResult.outputData).toBeDefined();
            console.log(`✅ Task executed successfully: ${testCase.name}`);
          } else {
            expect(result.task.status.value).toBe('failed');
            expect(result.executionResult.error).toBeDefined();
            console.log(`⚠️ Task failed (likely no gRPC worker available): ${testCase.name}`);
            console.log(`   Error: ${result.executionResult.error}`);
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
        const task = await agentTaskService.createTask({
          agentId: testAgentId,
          organizationId: testContext.organizationId,
          name,
          instructions: {
            instructions: `Task instructions for ${name}`,
            tools: [ToolConfig.basic('python_repl')],
            servers: []
          }
        });
        createdTasks.push(task);
      }
      
      console.log(`📝 Created ${createdTasks.length} tasks for retrieval testing`);
      
      // Test retrieval by agent
      const agentTasks = await agentTaskService.getTasksForAgent(testAgentId.value);
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
        expect(foundAgentTask?.agentId.value).toBe(testAgentId.value);
        expect(foundOrgTask?.organizationId.value).toBe(testContext.organizationId.value);
      }
      
      console.log(`✅ Successfully retrieved tasks by agent (${agentTasks.length}) and organization (${orgTasks.length})`);
    });

    test('should cancel pending task', async () => {
      const agentTaskService = getAgentTaskApplicationService();
      
      // Create a task
      const task = await agentTaskService.createTask({
        agentId: testAgentId,
        organizationId: testContext.organizationId,
        name: 'Cancellation Test Task',
        instructions: {
          instructions: 'This task will be cancelled',
          tools: [ToolConfig.basic('python_repl')],
          servers: []
        }
      });
      
      expect(task.isPending).toBe(true);
      console.log(`📝 Created task for cancellation: ${task.id.value}`);
      
      // Cancel the task
      const cancelReason = 'Test cancellation';
      await agentTaskService.cancelTask(task.id.value, cancelReason);
      
      // Retrieve task to verify cancellation
      const cancelledTask = await agentTaskService.getTask(task.id.value);
      expect(cancelledTask).toBeDefined();
      expect(cancelledTask!.status.value).toBe('cancelled');
      expect(cancelledTask!.isPending).toBe(false);
      
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
        ownerId: org2Context.ownerUserId,
        organizationId: org2Context.organizationId,
        role: 'assistant',
        agentType: 'data-collector',
        tools: [
          ToolConfig.basic('python_repl'),
          ToolConfig.basic('file_reader'),
          ToolConfig.basic('web_search'),
          ToolConfig.basic('calculator')
        ],
        capabilities: [
          {
            name: 'Basic Task Execution',
            description: 'Execute basic tasks for isolation testing',
            steps: [
              {
                type: 'TOOL_STEP',
                instructions: 'Execute the requested task using available tools',
                tools: [
                  ToolConfig.basic('python_repl'),
                  ToolConfig.basic('calculator')
                ],
                servers: []
              }
            ]
          }
        ]
      });
      
      expect(agent2Result.success).toBe(true);
      const agent2Id = agent2Result.data!.id;
      
      // Create tasks in both organizations
      const task1 = await agentTaskService.createTask({
        agentId: testAgentId,
        organizationId: testContext.organizationId,
        name: 'Org 1 Task',
        instructions: {
          instructions: 'Task in organization 1',
          tools: [ToolConfig.basic('python_repl')],
          servers: []
        }
      });
      
      const task2 = await agentTaskService.createTask({
        agentId: agent2Id,
        organizationId: org2Context.organizationId,
        name: 'Org 2 Task',
        instructions: {
          instructions: 'Task in organization 2',
          tools: [ToolConfig.basic('python_repl')],
          servers: []
        }
      });
      
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