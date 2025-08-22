import { db, rawClient } from '../../db/client';
import { initializeDI } from './container';

/**
 * Initialize dependency injection container with database clients
 * This should be called once at application startup
 */
export function setupDependencyInjection(): void {
  try {
    initializeDI(db, rawClient);
  } catch (error) {
    console.error('Failed to initialize dependency injection:', error);
    throw error;
  }
}

// Auto-initialize in non-test environments
// Tests should manually initialize with test clients
if (process.env.NODE_ENV !== 'test') {
  setupDependencyInjection();
}