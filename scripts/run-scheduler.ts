#!/usr/bin/env tsx
/**
 * Standalone Scheduler Runner
 * Runs the simplified event-driven scheduler as an independent process
 */

import { simplifiedAgentScheduler } from '@/lib/scheduler';

// Environment validation
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

async function main() {
  console.log('🚀 Starting Emery Agent Scheduler...');
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: ${process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***@')}`);
  
  try {
    // Start the simplified scheduler
    await simplifiedAgentScheduler.start();
    
    console.log('✅ Scheduler started successfully');
    console.log('🎧 Listening for events...');
    console.log('📋 Press Ctrl+C to stop');
    
    // Keep the process alive
    process.on('SIGINT', async () => {
      console.log('\n🛑 Received SIGINT, shutting down gracefully...');
      await simplifiedAgentScheduler.stop();
      console.log('✅ Scheduler stopped');
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
      await simplifiedAgentScheduler.stop();
      console.log('✅ Scheduler stopped');
      process.exit(0);
    });
    
    // Keep process alive
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Failed to start scheduler:', error);
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