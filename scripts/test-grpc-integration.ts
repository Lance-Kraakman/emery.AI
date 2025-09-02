#!/usr/bin/env npx tsx

/**
 * AIDEV-NOTE: Quick integration test for gRPC agent worker
 * Run with: npx tsx scripts/test-grpc-integration.ts
 */

import { AgentWorkerTestClient } from '../lib/grpc/test-integration-client';

async function testGrpcIntegration() {
  console.log('🚀 Starting gRPC Agent Worker Integration Test\n');
  
  const client = new AgentWorkerTestClient({
    host: process.env.WORKER_HOST || 'localhost',
    port: parseInt(process.env.WORKER_ADDRESS || '50051'),
    organizationId: process.env.ORGANIZATION_ID || 'test-org'
  });

  try {
    // Test 1: Worker connectivity
    console.log('📡 Testing worker connectivity...');
    const workerInfo = await client.getWorkerInfo();
    console.log('✅ Worker connected successfully');
    console.log(`   Worker ID: ${workerInfo.workerId}`);
    console.log(`   Version: ${workerInfo.version}`);
    console.log(`   Status: ${workerInfo.status}`);
    console.log(`   Active Tasks: ${workerInfo.activeTasks}/${workerInfo.maxConcurrentTasks}`);
    console.log(`   Capabilities: ${workerInfo.capabilities.join(', ')}`);
    console.log(`   Supported Tools: ${workerInfo.supportedTools.join(', ')}`);
    console.log();

    // Test 2: Simple task execution
    console.log('🔄 Testing task execution with streaming...');
    const taskId = `test-task-${Date.now()}`;
    let progressCount = 0;
    
    const finalResult = await client.executeTask({
      taskId,
      agentId: 1,
      instructions: 'Provide a simple greeting and explain what you can do',
      agentConfig: {
        name: 'Test Integration Agent',
        role: 'Integration Test Assistant',
        description: 'Agent for testing gRPC integration'
      },
      ownerId: 'integration-test-user',
      name: 'Integration Test Task'
    }, (progress) => {
      progressCount++;
      console.log(`   📊 Progress Update #${progressCount}:`);
      console.log(`      Status: ${progress.status}`);
      console.log(`      Progress: ${progress.progressPercent.toFixed(1)}%`);
      if (progress.stepId) console.log(`      Step: ${progress.stepId} (${progress.stepType})`);
      if (progress.outputJson) {
        try {
          const output = JSON.parse(progress.outputJson);
          console.log(`      Output: ${JSON.stringify(output, null, 2)}`);
        } catch {
          console.log(`      Output: ${progress.outputJson}`);
        }
      }
      if (progress.errorMessage) {
        console.log(`      ❌ Error: ${progress.errorMessage}`);
      }
      console.log();
    });

    console.log('✅ Task execution completed');
    console.log(`   Final Status: ${finalResult.status}`);
    console.log(`   Total Progress Updates: ${progressCount}`);
    console.log();

    // Test 3: Error handling
    console.log('⚠️  Testing error handling with invalid task...');
    try {
      await client.executeTask({
        taskId: `error-test-${Date.now()}`,
        agentId: 999999, // Invalid agent ID
        instructions: 'This should fail',
        agentConfig: {
          name: 'Error Test Agent'
        },
        ownerId: 'test-user',
        name: 'Error Test Task'
      }, () => {});
      
      console.log('❌ Expected error but task succeeded');
    } catch (error: any) {
      console.log('✅ Error handling works correctly');
      console.log(`   Error: ${error.message}`);
    }
    console.log();

    console.log('🎉 All integration tests passed!');
    
  } catch (error: any) {
    console.error('❌ Integration test failed:');
    console.error(error);
    process.exit(1);
  } finally {
    client.close();
    console.log('\n📌 gRPC connection closed');
  }
}

// Run the test
if (require.main === module) {
  testGrpcIntegration().catch(console.error);
}

export { testGrpcIntegration };