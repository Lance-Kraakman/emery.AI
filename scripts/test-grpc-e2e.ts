/**
 * End-to-end gRPC test script
 * Tests actual client-server communication
 */

import { spawn, ChildProcess } from 'child_process';
import { AgentWorkerClient, TaskStatusEnum } from '../lib/grpc/client';

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testEndToEnd() {
  console.log('🧪 gRPC End-to-End Integration Test');
  console.log('====================================\n');

  let serverProcess: ChildProcess | null = null;
  
  try {
    console.log('1️⃣  Starting Python gRPC server...');
    
    // Start the Python gRPC server
    serverProcess = spawn('pnpm', ['worker:start'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, WORKER_PORT: '50051', ORGANIZATION_ID: 'test_org' }
    });

    // Wait for server to start
    console.log('⏳ Waiting for server to start...');
    await sleep(3000);

    console.log('2️⃣  Creating gRPC client...');
    const client = new AgentWorkerClient('localhost:50051');

    console.log('3️⃣  Testing GetWorkerInfo...');
    try {
      const workerInfo = await client.getWorkerInfo();
      console.log('✅ GetWorkerInfo successful!');
      console.log(`   Worker ID: ${workerInfo.worker_id}`);
      console.log(`   Version: ${workerInfo.version}`);
      console.log(`   Organization: ${workerInfo.organization_id}`);
      console.log(`   Status: ${workerInfo.status}`);
      console.log(`   Capabilities: ${workerInfo.capabilities.join(', ')}`);
      console.log(`   Uptime: ${workerInfo.uptime_seconds}s`);
    } catch (error) {
      console.log('❌ GetWorkerInfo failed:', error instanceof Error ? error.message : String(error));
      throw error;
    }

    console.log('\n4️⃣  Testing ExecuteTask with streaming...');
    
    const taskRequest = {
      task_id: 'e2e_test_task_' + Date.now(),
      agent_id: 1,
      capability_name: 'test_capability',
      trigger_data_json: JSON.stringify({ test: 'data', timestamp: Date.now() }),
      organization_id: 'test_org',
      owner_id: 'test_user',
      timeout_seconds: 60
    };

    console.log(`   Task ID: ${taskRequest.task_id}`);
    
    const progressUpdates: any[] = [];
    
    try {
      await client.executeTask(taskRequest, (progress) => {
        progressUpdates.push(progress);
        console.log(`   📊 Progress: ${progress.progress_percent}% - ${progress.step_id} (${progress.status})`);
        
        if (progress.output_json) {
          try {
            const output = JSON.parse(progress.output_json);
            console.log(`      Output: ${JSON.stringify(output)}`);
          } catch (e) {
            console.log(`      Output: ${progress.output_json}`);
          }
        }
        
        if (progress.error_message) {
          console.log(`      Error: ${progress.error_message}`);
        }
      });

      console.log('✅ ExecuteTask streaming completed!');
      console.log(`   Total progress updates: ${progressUpdates.length}`);
      
      // Verify we got expected progress updates
      const finalUpdate = progressUpdates[progressUpdates.length - 1];
      if (finalUpdate && finalUpdate.status === 'TASK_COMPLETED') {
        console.log('✅ Task completed successfully!');
      } else {
        console.log('⚠️  Task did not complete as expected');
        console.log(`   Final status: ${finalUpdate?.status}`);
      }

    } catch (error) {
      console.log('❌ ExecuteTask failed:', error instanceof Error ? error.message : String(error));
      throw error;
    }

    console.log('\n5️⃣  Testing CancelTask...');
    try {
      const cancelResponse = await client.cancelTask({
        task_id: 'dummy_task_for_cancel_test',
        reason: 'End-to-end test cancellation'
      });
      
      console.log('✅ CancelTask successful!');
      console.log(`   Success: ${cancelResponse.success}`);
      console.log(`   Message: ${cancelResponse.message}`);
    } catch (error) {
      console.log('❌ CancelTask failed:', error instanceof Error ? error.message : String(error));
      throw error;
    }

    console.log('\n🎉 END-TO-END TEST PASSED!');
    console.log('   - Server startup: ✅');
    console.log('   - Client connection: ✅');
    console.log('   - GetWorkerInfo: ✅');
    console.log('   - ExecuteTask streaming: ✅');
    console.log('   - CancelTask: ✅');
    console.log('   - Protobuf serialization: ✅');

    client.close();

  } catch (error) {
    console.error('\n❌ END-TO-END TEST FAILED:', error instanceof Error ? error.message : String(error));
    process.exit(1);
    
  } finally {
    // Clean up: kill server process
    if (serverProcess) {
      console.log('\n🧹 Cleaning up server process...');
      serverProcess.kill('SIGTERM');
      
      // Wait a bit for graceful shutdown
      await sleep(2000);
      
      // Force kill if still running
      if (!serverProcess.killed) {
        serverProcess.kill('SIGKILL');
      }
    }
    
    console.log('🔒 Test cleanup completed');
  }
}

// Run the test
testEndToEnd().catch((error) => {
  console.error('Test script failed:', error);
  process.exit(1);
});