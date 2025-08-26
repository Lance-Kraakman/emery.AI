#!/usr/bin/env tsx

import { getTaskSchedulingApplicationService } from "@/ddd/application/di/scheduling-container";

/**
 * Standalone Scheduler Runner
 * Runs the simplified event-driven scheduler as an independent process
 */


// Environment validation
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

async function main() {
  console.log('🚀 Starting Emery Event-Driven Agent Scheduler...');
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: ${process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***@')}`);
  
  try {
    // Get the task scheduling application service
    const taskScheduler = getTaskSchedulingApplicationService();
    
    // Start processing tasks periodically
    const processingInterval = setInterval(async () => {
      try {
        const result = await taskScheduler.processPendingTasks(10);
        if (result.processed > 0 || result.failed > 0) {
          console.log(`📊 Processed: ${result.processed}, Failed: ${result.failed}, Queued: ${result.queued}`);
        }
      } catch (error: any) {
        console.error('❌ Error processing tasks:', error.message);
      }
    }, 30000); // Process every 30 seconds
    
    console.log('✅ Task scheduler started successfully');
    console.log('🎧 Processing tasks every 30 seconds...');
    console.log('📋 Press Ctrl+C to stop');
    
    // Log initial status
    const stats = await taskScheduler.getExecutionStats();
    console.log(`📊 Initial stats: ${stats.taskStats.totalTasks} total tasks`);
    
    // Optional: Log status periodically for monitoring
    const statusTimer = setInterval(async () => {
      try {
        const currentStats = await taskScheduler.getExecutionStats();
        console.log(`📊 Queue: ${currentStats.queueStats.totalQueued} queued, ${currentStats.queueStats.processing} processing`);
      } catch (error: any) {
        console.error('❌ Error getting status:', error.message);
      }
    }, 60000); // Log every minute
    
    // Clean up timers on shutdown
    const cleanup = () => {
      if (statusTimer) {
        clearInterval(statusTimer);
      }
      if (processingInterval) {
        clearInterval(processingInterval);
      }
    };
    
    // Update signal handlers to include timer cleanup
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    
    process.on('SIGINT', async () => {
      cleanup();
      console.log('\n🛑 Received SIGINT, shutting down gracefully...');
      console.log('✅ Task scheduler stopped');
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      cleanup();
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
      console.log('✅ Task scheduler stopped');
      process.exit(0);
    });
    
    // Keep process alive
    await new Promise(() => {});
    
  } catch (error: any) {
    console.error('❌ Failed to start task scheduler:', error.message);
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

// Start the scheduler
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
