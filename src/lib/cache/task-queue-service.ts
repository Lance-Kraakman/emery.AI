/**
 * Redis-Backed Task Queue Service
 *
 * Provides distributed concurrency control and debouncing for task execution.
 * Uses Redis for coordination across multiple scheduler instances.
 *
 * Features:
 * - Per-organization concurrency limits (prevents one org from starving others)
 * - Task debouncing (prevents duplicate processing of same task)
 * - Graceful degradation to in-memory when Redis unavailable
 */

import Redis from 'ioredis';

export interface ITaskQueueService {
  /**
   * Acquire debounce lock for a task.
   * Returns true if this caller should process the task.
   * Returns false if another caller recently processed it.
   */
  acquireDebounce(taskId: string, windowMs?: number): Promise<boolean>;

  /**
   * Acquire execution slot for an organization.
   * Blocks until a slot is available (respects per-org concurrency limit).
   */
  acquireExecutionSlot(organizationId: string, taskId: string): Promise<void>;

  /**
   * Release execution slot when task completes.
   */
  releaseExecutionSlot(organizationId: string, taskId: string): Promise<void>;

  /**
   * Get queue statistics for an organization.
   */
  getStats(organizationId: string): Promise<{ active: number; maxConcurrent: number }>;

  /**
   * Check if the service is connected and operational.
   */
  isConnected(): boolean;
}

/**
 * Redis-backed implementation using ioredis.
 */
export class RedisTaskQueueService implements ITaskQueueService {
  private readonly redis: Redis;
  private readonly maxConcurrentPerOrg: number;
  private readonly debounceWindowMs: number;
  private readonly slotAcquireTimeoutMs: number;
  private readonly slotPollIntervalMs: number;
  private connected: boolean = false;

  constructor(
    redisUrl: string,
    options: {
      maxConcurrentPerOrg?: number;
      debounceWindowMs?: number;
      slotAcquireTimeoutMs?: number;
      slotPollIntervalMs?: number;
    } = {}
  ) {
    this.maxConcurrentPerOrg = options.maxConcurrentPerOrg ?? 10;
    this.debounceWindowMs = options.debounceWindowMs ?? 30_000; // 30 seconds
    this.slotAcquireTimeoutMs = options.slotAcquireTimeoutMs ?? 300_000; // 5 minutes
    this.slotPollIntervalMs = options.slotPollIntervalMs ?? 500; // 500ms polling

    this.redis = new Redis(redisUrl, {
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn('[TaskQueue] Redis connection failed after 3 retries');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    this.redis.on('connect', () => {
      this.connected = true;
      console.log('[TaskQueue] Connected to Redis');
    });

    this.redis.on('error', (error) => {
      this.connected = false;
      console.error('[TaskQueue] Redis error:', error.message);
    });

    this.redis.on('close', () => {
      this.connected = false;
    });

    // Attempt connection
    this.redis.connect().catch(() => {
      // Connection error handled by event listener
    });
  }

  // Key generators
  private debounceKey(taskId: string): string {
    return `emery:debounce:${taskId}`;
  }

  private activeKey(orgId: string): string {
    return `emery:queue:active:${orgId}`;
  }

  async acquireDebounce(taskId: string, windowMs?: number): Promise<boolean> {
    if (!this.connected) {
      console.warn('[TaskQueue] Redis not connected, skipping debounce check');
      return true; // Allow processing when Redis is down
    }

    const effectiveWindow = windowMs ?? this.debounceWindowMs;

    try {
      // SET NX = only set if not exists, PX = expire in milliseconds
      const result = await this.redis.set(
        this.debounceKey(taskId),
        Date.now().toString(),
        'PX',
        effectiveWindow,
        'NX'
      );
      const acquired = result === 'OK';

      if (!acquired) {
        console.log(`[TaskQueue] Debounce blocked task ${taskId.substring(0, 8)} (within ${effectiveWindow}ms window)`);
      }

      return acquired;
    } catch (error) {
      console.error('[TaskQueue] Debounce check error:', error);
      return true; // Allow processing on error
    }
  }

  async acquireExecutionSlot(organizationId: string, taskId: string): Promise<void> {
    if (!this.connected) {
      console.warn('[TaskQueue] Redis not connected, allowing immediate execution');
      return;
    }

    const activeKey = this.activeKey(organizationId);
    const startTime = Date.now();

    while (true) {
      try {
        // Check current active count
        const activeCount = await this.redis.scard(activeKey);

        if (activeCount < this.maxConcurrentPerOrg) {
          // Try to add ourselves atomically
          const added = await this.redis.sadd(activeKey, taskId);

          if (added > 0) {
            // Successfully acquired slot - set TTL to prevent leaks
            await this.redis.expire(activeKey, 300); // 5 minute TTL
            console.log(
              `[TaskQueue] Task ${taskId.substring(0, 8)} acquired slot for org ${organizationId} ` +
              `(${activeCount + 1}/${this.maxConcurrentPerOrg} active)`
            );
            return;
          }
        }

        // Check timeout
        if (Date.now() - startTime > this.slotAcquireTimeoutMs) {
          console.error(
            `[TaskQueue] Timeout waiting for slot: org ${organizationId}, task ${taskId.substring(0, 8)}`
          );
          throw new Error(`Timeout waiting for execution slot after ${this.slotAcquireTimeoutMs}ms`);
        }

        // Wait and retry
        console.log(
          `[TaskQueue] Task ${taskId.substring(0, 8)} waiting for slot ` +
          `(org ${organizationId}: ${activeCount}/${this.maxConcurrentPerOrg} active)`
        );
        await new Promise(resolve => setTimeout(resolve, this.slotPollIntervalMs));

      } catch (error) {
        if ((error as Error).message.includes('Timeout')) {
          throw error;
        }
        console.error('[TaskQueue] Error acquiring slot:', error);
        // On Redis error, allow execution to prevent blocking
        return;
      }
    }
  }

  async releaseExecutionSlot(organizationId: string, taskId: string): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      const removed = await this.redis.srem(this.activeKey(organizationId), taskId);
      if (removed > 0) {
        console.log(`[TaskQueue] Task ${taskId.substring(0, 8)} released slot for org ${organizationId}`);
      }
    } catch (error) {
      console.error('[TaskQueue] Error releasing slot:', error);
    }
  }

  async getStats(organizationId: string): Promise<{ active: number; maxConcurrent: number }> {
    if (!this.connected) {
      return { active: 0, maxConcurrent: this.maxConcurrentPerOrg };
    }

    try {
      const active = await this.redis.scard(this.activeKey(organizationId));
      return { active, maxConcurrent: this.maxConcurrentPerOrg };
    } catch (error) {
      console.error('[TaskQueue] Error getting stats:', error);
      return { active: 0, maxConcurrent: this.maxConcurrentPerOrg };
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

/**
 * In-memory fallback implementation for when Redis is not available.
 * Provides same interface but only works within a single process.
 */
export class InMemoryTaskQueueService implements ITaskQueueService {
  private readonly debounceMap = new Map<string, number>();
  private readonly activeTasksByOrg = new Map<string, Set<string>>();
  private readonly pendingByOrg = new Map<string, Array<{ taskId: string; resolve: () => void }>>();
  private readonly maxConcurrentPerOrg: number;
  private readonly debounceWindowMs: number;

  constructor(options: { maxConcurrentPerOrg?: number; debounceWindowMs?: number } = {}) {
    this.maxConcurrentPerOrg = options.maxConcurrentPerOrg ?? 10;
    this.debounceWindowMs = options.debounceWindowMs ?? 30_000;
  }

  async acquireDebounce(taskId: string, windowMs?: number): Promise<boolean> {
    const effectiveWindow = windowMs ?? this.debounceWindowMs;
    const now = Date.now();
    const lastProcessed = this.debounceMap.get(taskId);

    if (lastProcessed && (now - lastProcessed) < effectiveWindow) {
      return false;
    }

    this.debounceMap.set(taskId, now);

    // Cleanup old entries periodically
    if (this.debounceMap.size > 1000) {
      this.cleanupDebounceMap();
    }

    return true;
  }

  private cleanupDebounceMap(): void {
    const now = Date.now();
    const expiredThreshold = this.debounceWindowMs * 2;

    for (const [taskId, timestamp] of this.debounceMap.entries()) {
      if (now - timestamp > expiredThreshold) {
        this.debounceMap.delete(taskId);
      }
    }
  }

  async acquireExecutionSlot(organizationId: string, taskId: string): Promise<void> {
    let activeTasks = this.activeTasksByOrg.get(organizationId);
    if (!activeTasks) {
      activeTasks = new Set();
      this.activeTasksByOrg.set(organizationId, activeTasks);
    }

    if (activeTasks.size < this.maxConcurrentPerOrg) {
      activeTasks.add(taskId);
      return;
    }

    // Wait for a slot
    return new Promise(resolve => {
      let pending = this.pendingByOrg.get(organizationId);
      if (!pending) {
        pending = [];
        this.pendingByOrg.set(organizationId, pending);
      }
      pending.push({ taskId, resolve });
    });
  }

  async releaseExecutionSlot(organizationId: string, taskId: string): Promise<void> {
    const activeTasks = this.activeTasksByOrg.get(organizationId);
    if (activeTasks) {
      activeTasks.delete(taskId);

      // Process next in queue
      const pending = this.pendingByOrg.get(organizationId);
      if (pending && pending.length > 0 && activeTasks.size < this.maxConcurrentPerOrg) {
        const next = pending.shift();
        if (next) {
          activeTasks.add(next.taskId);
          next.resolve();
        }
      }
    }
  }

  async getStats(organizationId: string): Promise<{ active: number; maxConcurrent: number }> {
    const activeTasks = this.activeTasksByOrg.get(organizationId);
    return {
      active: activeTasks?.size ?? 0,
      maxConcurrent: this.maxConcurrentPerOrg,
    };
  }

  isConnected(): boolean {
    return true; // In-memory is always "connected"
  }
}

// Singleton instance
let taskQueueServiceInstance: ITaskQueueService | null = null;

/**
 * Create the task queue service based on environment variables.
 * Uses Redis if REDIS_URL is set, otherwise falls back to in-memory.
 */
export function createTaskQueueService(): ITaskQueueService {
  const redisUrl = process.env.REDIS_URL;
  const maxConcurrent = parseInt(process.env.TASK_MAX_CONCURRENT_PER_ORG || '10', 10);
  const debounceWindow = parseInt(process.env.TASK_DEBOUNCE_WINDOW_MS || '30000', 10);

  if (redisUrl) {
    console.log('[TaskQueue] Using Redis-backed queue:', redisUrl.replace(/\/\/.*@/, '//*****@'));
    return new RedisTaskQueueService(redisUrl, {
      maxConcurrentPerOrg: maxConcurrent,
      debounceWindowMs: debounceWindow,
    });
  }

  console.log('[TaskQueue] No Redis configured, using in-memory queue (single-instance only)');
  return new InMemoryTaskQueueService({
    maxConcurrentPerOrg: maxConcurrent,
    debounceWindowMs: debounceWindow,
  });
}

/**
 * Get the singleton task queue service instance.
 */
export function getTaskQueueService(): ITaskQueueService {
  if (!taskQueueServiceInstance) {
    taskQueueServiceInstance = createTaskQueueService();
  }
  return taskQueueServiceInstance;
}
