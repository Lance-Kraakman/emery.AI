/**
 * Scheduler startup initialization for NextJS
 * Starts the background agent scheduler when the server boots
 */

import { agentScheduler } from './agent-scheduler';

let schedulerStarted = false;

/**
 * Initialize the scheduler - should be called once during server startup
 */
export async function initializeScheduler(): Promise<void> {
  if (schedulerStarted) {
    console.log('[SCHEDULER-STARTUP] Scheduler already initialized');
    return;
  }

  // Only start scheduler in server environment
  if (typeof window !== 'undefined') {
    console.log('[SCHEDULER-STARTUP] Skipping scheduler initialization in browser');
    return;
  }

  // Skip scheduler in certain environments
  const skipScheduler = 
    process.env.NODE_ENV === 'test' || 
    process.env.SKIP_SCHEDULER === 'true' ||
    process.env.NEXT_PHASE === 'phase-production-build'; // Skip during build

  if (skipScheduler) {
    console.log('[SCHEDULER-STARTUP] Skipping scheduler initialization (disabled)');
    return;
  }

  try {
    console.log('[SCHEDULER-STARTUP] Initializing agent scheduler...');
    await agentScheduler.start();
    schedulerStarted = true;
    
    // Graceful shutdown handling
    const shutdownHandler = async () => {
      console.log('[SCHEDULER-STARTUP] Shutting down scheduler...');
      await agentScheduler.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdownHandler);
    process.on('SIGTERM', shutdownHandler);

    console.log('[SCHEDULER-STARTUP] Agent scheduler initialization completed');
  } catch (error) {
    console.error('[SCHEDULER-STARTUP] Failed to initialize scheduler:', error);
    // Don't throw - let the server start without the scheduler
  }
}

/**
 * Get scheduler initialization status
 */
export function isSchedulerInitialized(): boolean {
  return schedulerStarted;
}

// Auto-initialize in server environment (but not during build)
if (typeof window === 'undefined' && process.env.NEXT_PHASE !== 'phase-production-build') {
  // Use setTimeout to allow NextJS to finish initializing first
  setTimeout(() => {
    initializeScheduler().catch(error => {
      console.error('[SCHEDULER-STARTUP] Auto-initialization failed:', error);
    });
  }, 1000);
}