/**
 * Scheduler module exports and auto-initialization
 */

export { AgentScheduler, agentScheduler } from './agent-scheduler';
export { initializeScheduler, isSchedulerInitialized } from './startup';
export { DatabaseTriggerManager } from './database-triggers';

// Import startup to trigger auto-initialization
import './startup';