#!/usr/bin/env tsx
/**
 * Scheduler Debug & Health Check Utility
 * 
 * This script provides debugging utilities for the Emery scheduler system
 */

import { getEventDrivenSchedulingService } from '../ddd/application/di/scheduling-container';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'status':
      await checkSchedulerStatus();
      break;
    case 'test-events':
      await testEventSystem();
      break;
    case 'health':
      await healthCheck();
      break;
    case 'trigger-cycle':
      await triggerManualCycle();
      break;
    default:
      showUsage();
  }
}

async function checkSchedulerStatus() {
  console.log('📊 Checking Scheduler Status...\n');
  
  try {
    const eventDrivenScheduler = getEventDrivenSchedulingService();
    const status = await eventDrivenScheduler.getStatus();
    
    console.log('📋 Event-Driven Scheduler Status:');
    console.log(`   Running: ${status.isRunning ? '✅' : '❌'}`);
    console.log(`   Event Callbacks Registered: ${status.eventCallbacksRegistered}`);
    console.log(`   Last Periodic Check: ${status.lastPeriodicCheck || 'Not yet'}`);
    
    console.log('\n📡 Event Scheduler Status:');
    console.log(`   Running: ${status.eventScheduler.isRunning ? '✅' : '❌'}`);
    console.log(`   Active Listeners: ${status.eventScheduler.activeListeners.join(', ')}`);
    console.log(`   Events Processed: ${status.eventScheduler.eventsProcessed}`);
    console.log(`   Last Event: ${status.eventScheduler.lastEventTime || 'None'}`);
    
    console.log('\n📈 Scheduling System Status:');
    console.log(`   Active Jobs: ${status.scheduling.totalActiveJobs}`);
    console.log(`   Pending Events: ${status.scheduling.pendingEvents}`);
    console.log(`   Processing Events: ${status.scheduling.processingEvents}`);
    console.log(`   Failed Jobs: ${status.scheduling.failedJobs}`);
    console.log(`   System Load: ${status.scheduling.systemLoad}`);
    
    if (status.eventScheduler.errors.length > 0) {
      console.log('\n❌ Recent Errors:');
      status.eventScheduler.errors.forEach(error => console.log(`   • ${error}`));
    }
    
  } catch (error) {
    console.error('❌ Error checking status:', error);
    process.exit(1);
  }
}

async function testEventSystem() {
  console.log('🧪 Testing Event System...\n');
  
  try {
    const eventDrivenScheduler = getEventDrivenSchedulingService();
    
    console.log('🔥 Triggering manual periodic cycle...');
    await eventDrivenScheduler.triggerManualCycle();
    console.log('✅ Manual cycle triggered successfully');
    
    // Wait a moment for event processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const status = await eventDrivenScheduler.getStatus();
    console.log(`📊 Events processed after test: ${status.eventScheduler.eventsProcessed}`);
    
  } catch (error) {
    console.error('❌ Error testing events:', error);
    process.exit(1);
  }
}

async function healthCheck() {
  console.log('🏥 Performing Health Check...\n');
  
  try {
    // Check database connection
    console.log('🗄️ Checking database connection...');
    if (!process.env.DATABASE_URL) {
      console.log('❌ DATABASE_URL not set');
      process.exit(1);
    }
    console.log('✅ DATABASE_URL configured');
    
    // Check scheduler initialization
    console.log('🏗️ Checking scheduler initialization...');
    const eventDrivenScheduler = getEventDrivenSchedulingService();
    const status = await eventDrivenScheduler.getStatus();
    
    if (!status.isRunning) {
      console.log('❌ Scheduler not running');
      process.exit(1);
    }
    console.log('✅ Scheduler running');
    
    if (status.eventCallbacksRegistered < 4) {
      console.log('❌ Not all event callbacks registered');
      process.exit(1);
    }
    console.log('✅ All event callbacks registered');
    
    if (status.eventScheduler.activeListeners.length < 3) {
      console.log('❌ Not all database listeners active');
      process.exit(1);
    }
    console.log('✅ All database listeners active');
    
    console.log('\n🎉 Health check passed! Scheduler is working correctly.');
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  }
}

async function triggerManualCycle() {
  console.log('🎯 Triggering Manual Scheduling Cycle...\n');
  
  try {
    const eventDrivenScheduler = getEventDrivenSchedulingService();
    await eventDrivenScheduler.triggerManualCycle();
    console.log('✅ Manual cycle triggered successfully');
  } catch (error) {
    console.error('❌ Error triggering cycle:', error);
    process.exit(1);
  }
}

function showUsage() {
  console.log(`
📋 Scheduler Debug Utility

Usage: npx tsx scripts/debug-scheduler.ts <command>

Commands:
  status        - Show detailed scheduler status
  test-events   - Test the event system functionality  
  health        - Perform comprehensive health check
  trigger-cycle - Manually trigger a scheduling cycle
  
Environment Variables:
  DATABASE_URL  - PostgreSQL connection string (required)

Examples:
  npx tsx scripts/debug-scheduler.ts status
  DATABASE_URL=postgresql://... npx tsx scripts/debug-scheduler.ts health
  `);
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the debug utility
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});