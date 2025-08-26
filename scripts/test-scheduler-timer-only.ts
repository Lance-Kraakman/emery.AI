#!/usr/bin/env tsx
/**
 * Test Scheduler with Timer-Only (No Event Callbacks)
 * Tests if scheduler works with just the 5-minute periodic timer
 */

import { getSchedulingApplicationService } from '../ddd/application/di/scheduling-container';
import { PostgresEventScheduler } from '../ddd/infrastructure/scheduling/services/postgres-event-scheduler';

// Environment validation
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

async function main() {
  console.log('🚀 Starting Timer-Only Scheduler Test...');
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: ${process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***@')}`);
  
  try {
    // Get just the scheduling application service (core logic)
    const schedulingService = getSchedulingApplicationService();
    
    // Create event scheduler but DON'T register callbacks
    const eventScheduler = new PostgresEventScheduler();
    
    console.log('⏰ Testing timer-only periodic scheduling...');
    
    // Start the event scheduler (this starts the 5-minute timer)
    await eventScheduler.start();
    
    console.log('✅ Timer-based scheduler started (no event callbacks registered)');
    console.log('🎧 Only periodic timer running (every 5 minutes)...');
    
    // Manually trigger a scheduling cycle to test
    console.log('🎯 Testing manual scheduling cycle...');
    const result = await schedulingService.processSchedulingCycle();
    console.log(`✅ Manual cycle completed: ${result.dueJobs} jobs, ${result.eventsProcessed} events processed`);
    
    // Wait for periodic timer
    let cycles = 0;
    const maxCycles = 2; // Wait for 2 periodic cycles
    
    console.log(`⏰ Waiting for ${maxCycles} periodic timer cycles (${maxCycles * 5} minutes total)...`);
    
    const intervalId = setInterval(async () => {
      cycles++;
      console.log(`⏰ Periodic cycle ${cycles} should have occurred...`);
      
      // Check scheduler status
      const status = await eventScheduler.getStatus();
      console.log(`📊 Events processed so far: ${status.eventsProcessed}`);
      
      if (cycles >= maxCycles) {
        console.log('✅ Timer-only test completed successfully');
        clearInterval(intervalId);
        await eventScheduler.stop();
        process.exit(0);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
    
    // For testing, let's also manually trigger a few cycles
    setTimeout(async () => {
      console.log('🎯 Triggering manual periodic check...');
      await eventScheduler.triggerEvent({
        type: 'periodic_check',
        payload: {
          timestamp: new Date(),
          metadata: { source: 'manual_test' }
        },
        priority: 'high'
      });
    }, 10000); // After 10 seconds
    
    // Signal handlers
    process.on('SIGINT', async () => {
      console.log('\n🛑 Stopping timer-only scheduler...');
      clearInterval(intervalId);
      await eventScheduler.stop();
      console.log('✅ Timer-only scheduler stopped');
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\n🛑 Received SIGTERM, stopping...');
      clearInterval(intervalId);
      await eventScheduler.stop();
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