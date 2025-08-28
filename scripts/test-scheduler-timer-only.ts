#!/usr/bin/env tsx
/**
 * Test Scheduler with Timer-Only (No Event Callbacks)
 * Tests the new TaskSchedulingApplicationService with periodic execution
 */

import { getTaskSchedulingApplicationService } from '../ddd/application/di/scheduling-container';

// Environment validation
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

async function main() {
  console.log('🚀 Starting TaskSchedulingApplicationService Test...');
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: ${process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***@')}`);
  
  try {
    // Get the new task scheduling application service
    const schedulingService = getTaskSchedulingApplicationService();
    
    console.log('⏰ Testing task scheduling service...');
    
    // Test manual scheduling cycle
    console.log('🎯 Testing manual scheduling cycle...');
    const result = await schedulingService.processPendingTasks();
    console.log(`✅ Manual cycle completed: ${result.processed} processed, ${result.failed} failed, ${result.queued} queued`);
    
    // Test execution stats
    const stats = await schedulingService.getExecutionStats();
    console.log(`📊 Execution stats: ${stats.taskStats.totalTasks} total tasks, ${stats.queueStats.processing} processing`);
    
    // Set up periodic processing every 30 seconds for testing
    let cycles = 0;
    const maxCycles = 5; // Run 5 cycles for testing
    
    console.log(`⏰ Starting periodic processing (every 30 seconds for ${maxCycles} cycles)...`);
    
    const intervalId = setInterval(async () => {
      cycles++;
      console.log(`⏰ Periodic cycle ${cycles}...`);
      
      // Process pending tasks
      try {
        const cycleResult = await schedulingService.processPendingTasks();
        console.log(`  📊 Processed: ${cycleResult.processed}, Failed: ${cycleResult.failed}, Queued: ${cycleResult.queued}`);
        
        // Show current stats
        const currentStats = await schedulingService.getExecutionStats();
        console.log(`  📈 Queue: ${currentStats.queueStats.totalQueued} queued, ${currentStats.queueStats.processing} processing`);
      } catch (error: any) {
        console.error(`  ❌ Cycle ${cycles} failed:`, error.message);
      }
      
      if (cycles >= maxCycles) {
        console.log('✅ Periodic test completed successfully');
        clearInterval(intervalId);
        process.exit(0);
      }
    }, 30000); // Check every 30 seconds
    
    // Signal handlers
    process.on('SIGINT', async () => {
      console.log('\n🛑 Stopping scheduler test...');
      clearInterval(intervalId);
      console.log('✅ Scheduler test stopped');
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\n🛑 Received SIGTERM, stopping...');
      clearInterval(intervalId);
      process.exit(0);
    });
    
    // Keep process alive
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Timer-only scheduler test failed:', error);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Start the test
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});