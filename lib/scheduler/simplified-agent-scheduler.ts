/**
 * Simplified Event-Driven Agent Scheduler
 * Orchestrates all trigger type dispatchers for scalable task execution
 */
import { manualDispatcher } from './dispatchers/manual-dispatcher';
import { databaseDispatcher } from './dispatchers/database-dispatcher';
import { calendarDispatcher } from './dispatchers/calendar-dispatcher';
import { taskExecutionPipeline } from './task-execution-pipeline';
import { db } from '@/lib/db/client';
import { tasks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export class SimplifiedAgentScheduler {
  private isRunning = false;

  /**
   * Start all dispatchers
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[SCHEDULER] Already running');
      return;
    }

    console.log('[SCHEDULER] 🚀 Starting simplified event-driven scheduler...');
    this.isRunning = true;

    try {
      // Start all dispatchers in parallel
      await Promise.allSettled([
        manualDispatcher.start(),
        databaseDispatcher.start(), 
        calendarDispatcher.start()
      ]);

      console.log('[SCHEDULER] ✅ All dispatchers started successfully');
      console.log('[SCHEDULER] 📋 Trigger types supported: MANUAL, DATABASE_EVENT, CALENDAR');
      
      // Process any existing pending tasks
      await this.processExistingPendingTasks();
      
    } catch (error) {
      console.error('[SCHEDULER] ❌ Error starting scheduler:', error);
      throw error;
    }
  }

  /**
   * Stop all dispatchers
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    console.log('[SCHEDULER] 🛑 Stopping simplified scheduler...');

    try {
      // Stop all dispatchers in parallel
      await Promise.allSettled([
        manualDispatcher.stop(),
        databaseDispatcher.stop(),
        calendarDispatcher.stop()
      ]);

      this.isRunning = false;
      console.log('[SCHEDULER] ✅ All dispatchers stopped successfully');
      
    } catch (error) {
      console.error('[SCHEDULER] ❌ Error stopping scheduler:', error);
    }
  }

  /**
   * Process existing pending tasks (called during startup)
   * AIDEV-NOTE: Handles orphaned tasks from previous system or restarts
   */
  async processExistingPendingTasks(): Promise<void> {
    try {
      console.log('[SCHEDULER] 🔍 Checking for existing pending tasks...');
      
      // Get all pending tasks
      const pendingTasks = await db
        .select()
        .from(tasks)
        .where(eq(tasks.status, 'pending'))
        .limit(50); // Process max 50 at startup to prevent overload

      if (pendingTasks.length === 0) {
        console.log('[SCHEDULER] ✅ No existing pending tasks found');
        return;
      }

      console.log(`[SCHEDULER] 📝 Found ${pendingTasks.length} pending tasks, processing...`);

      // Process tasks in parallel (but limited)
      const processingPromises = pendingTasks.map(async (task) => {
        try {
          const result = await taskExecutionPipeline.executeExistingTask(task.id);
          if (result.success) {
            console.log(`[SCHEDULER] ✅ Processed pending task ${task.id.substring(0, 8)}`);
          } else {
            console.log(`[SCHEDULER] ❌ Failed to process pending task ${task.id.substring(0, 8)}: ${result.error}`);
          }
        } catch (error) {
          console.error(`[SCHEDULER] ❌ Error processing pending task ${task.id.substring(0, 8)}:`, error);
        }
      });

      // Wait for all tasks to process (or fail)
      await Promise.allSettled(processingPromises);
      
      console.log(`[SCHEDULER] 🏁 Finished processing ${pendingTasks.length} existing pending tasks`);
      
    } catch (error) {
      console.error('[SCHEDULER] ❌ Error processing existing pending tasks:', error);
    }
  }
}

// Global simplified scheduler instance
export const simplifiedAgentScheduler = new SimplifiedAgentScheduler();