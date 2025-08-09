/**
 * Test gRPC connection and streaming to debug task completion issues
 */

import { workerRegistry } from '../lib/grpc/client';

async function testGRPCConnection() {
  console.log('🔍 Testing gRPC Connection...\n');
  
  try {
    // Get worker for organization 1 (should connect to port 50100)
    const workerClient = workerRegistry.getWorkerForOrganization('1');
    console.log('✅ Got worker client for org 1');
    
    // Test basic connection with GetWorkerInfo
    try {
      const workerInfo = await workerClient.getWorkerInfo();
      console.log('✅ Worker Info:', {
        worker_id: workerInfo.worker_id,
        organization_id: workerInfo.organization_id,
        active_tasks: workerInfo.active_tasks,
        status: workerInfo.status
      });
    } catch (error) {
      console.error('❌ GetWorkerInfo failed:', error);
      return;
    }
    
    // Test task execution with detailed logging
    const testTaskId = `test-${Date.now()}`;
    console.log(`\n🚀 Testing task execution: ${testTaskId}`);
    
    const taskRequest = {
      task_id: testTaskId,
      agent_id: 999,
      capability_name: 'test_capability',
      trigger_data_json: JSON.stringify({ test: 'grpc connection test' }),
      organization_id: '1',
      owner_id: 'test-owner',
      timeout_seconds: 30
    };
    
    let progressCount = 0;
    let lastStatus = null;
    let completionReceived = false;
    
    console.log('📡 Starting task execution with streaming...');
    
    await workerClient.executeTask(taskRequest, async (progress) => {
      progressCount++;
      lastStatus = progress.status;
      
      console.log(`📊 Progress Update #${progressCount}:`);
      console.log(`   Task ID: ${progress.task_id}`);
      console.log(`   Status: ${progress.status} (raw value)`);
      console.log(`   Step: ${progress.step_id} (${progress.step_type})`);
      console.log(`   Progress: ${progress.progress_percent}%`);
      console.log(`   Timestamp: ${progress.timestamp_ms}`);
      
      if (progress.output_json) {
        console.log(`   Output: ${progress.output_json.substring(0, 100)}...`);
      }
      
      if (progress.error_message) {
        console.log(`   Error: ${progress.error_message}`);
      }
      
      // Check for completion
      if (progress.status === 2) { // TASK_COMPLETED
        console.log('🎉 COMPLETION STATUS RECEIVED!');
        completionReceived = true;
      } else if (progress.status === 3) { // TASK_FAILED
        console.log('💥 FAILURE STATUS RECEIVED!');
        completionReceived = true;
      }
      
      console.log(''); // blank line
    });
    
    console.log('📋 Task Execution Summary:');
    console.log(`   Total progress updates: ${progressCount}`);
    console.log(`   Last status received: ${lastStatus}`);
    console.log(`   Completion received: ${completionReceived ? '✅ YES' : '❌ NO'}`);
    
    if (!completionReceived) {
      console.log('\n🔍 DEBUGGING INFO:');
      console.log('   This indicates the gRPC streaming is not receiving the final completion status.');
      console.log('   The worker logs show tasks completing, but NextJS is not getting that status.');
      console.log('   This is the root cause of tasks staying "in_progress" forever.');
    } else {
      console.log('\n✅ gRPC streaming is working correctly!');
    }
    
  } catch (error) {
    console.error('\n❌ gRPC Test Failed:', error);
  }
}

if (require.main === module) {
  testGRPCConnection().catch((error) => {
    console.error('Test error:', error);
    process.exit(1);
  });
}

export { testGRPCConnection };