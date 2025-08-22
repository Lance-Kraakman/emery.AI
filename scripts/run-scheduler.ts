#!/usr/bin/env tsx
/**
 * Standalone Scheduler Runner
 * Runs the simplified event-driven scheduler as an independent process
 */

import { getEventDrivenSchedulingService } from '../ddd/application/scheduling/di/scheduling-container';

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
    // Get the event-driven scheduling service
    const eventDrivenScheduler = getEventDrivenSchedulingService();
    
    // Start the event-driven scheduler (combines timer + database event callbacks)
    await eventDrivenScheduler.start();
    
    console.log('✅ Event-driven scheduler started successfully');
    console.log('🎧 Listening for database events and running periodic checks...');
    console.log('📋 Architecture: Timer-based fallback + Real-time event callbacks');
    console.log('📋 Press Ctrl+C to stop');
    
    // Log initial status
    const status = await eventDrivenScheduler.getStatus();
    console.log(`📊 Initial status: ${status.eventCallbacksRegistered} event callbacks registered`);
    console.log(`📊 Active listeners: ${status.eventScheduler.activeListeners.join(', ')}`);
    
    // Signal handlers will be set up after status timer
    
    // Optional: Log status periodically for monitoring
    const statusTimer = setInterval(async () => {
      try {
        const currentStatus = await eventDrivenScheduler.getStatus();
        if (currentStatus.eventScheduler.eventsProcessed > 0) {
          console.log(`📊 Status: ${currentStatus.eventScheduler.eventsProcessed} events processed, last event: ${currentStatus.eventScheduler.lastEventTime}`);
        }
      } catch (error) {
        console.error('❌ Error getting status:', error);
      }
    }, 60000); // Log every minute
    
    // Clean up status timer on shutdown - simplified approach
    const statusCleanup = () => {
      if (statusTimer) {
        clearInterval(statusTimer);
      }
    };
    
    // Update signal handlers to include timer cleanup
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    
    process.on('SIGINT', async () => {
      statusCleanup();
      console.log('\n🛑 Received SIGINT, shutting down gracefully...');
      await eventDrivenScheduler.stop();
      console.log('✅ Event-driven scheduler stopped');
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      statusCleanup();
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
      await eventDrivenScheduler.stop();
      console.log('✅ Event-driven scheduler stopped');
      process.exit(0);
    });
    
    // Keep process alive
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Failed to start event-driven scheduler:', error);
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
