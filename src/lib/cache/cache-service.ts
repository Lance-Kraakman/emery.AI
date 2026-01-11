/**
 * Distributed Cache Service
 *
 * Redis-backed caching layer using ioredis.
 *
 * Features:
 * - Get/Set/Delete operations with TTL
 * - Tag-based invalidation for cache groups
 * - Graceful degradation when Redis unavailable
 *
 * Local Development: Docker Redis
 * Production: AWS ElastiCache
 */

import Redis from 'ioredis';

export interface CacheOptions {
  /** TTL in seconds */
  ttlSeconds: number;
  /** Tags for grouped invalidation */
  tags?: string[];
}

export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options: CacheOptions): Promise<void>;
  delete(key: string): Promise<void>;
  invalidateByTag(tag: string): Promise<number>;
  isConnected(): boolean;
}

/**
 * No-op cache service for when Redis is not available.
 * All operations succeed but don't cache anything.
 */
export class NoOpCacheService implements ICacheService {
  async get<T>(): Promise<T | null> {
    return null;
  }

  async set(): Promise<void> {
    // No-op
  }

  async delete(): Promise<void> {
    // No-op
  }

  async invalidateByTag(): Promise<number> {
    return 0;
  }

  isConnected(): boolean {
    return false;
  }
}

/**
 * ioredis cache service for ElastiCache (production) and Docker Redis (local).
 */
export class IoRedisCacheService implements ICacheService {
  private readonly redis: Redis;
  private readonly keyPrefix: string;
  private connected: boolean = false;

  constructor(url: string, keyPrefix: string = 'emery:') {
    this.redis = new Redis(url, {
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn('[Cache] Redis connection failed after 3 retries');
          return null; // Stop retrying
        }
        return Math.min(times * 100, 3000);
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });
    this.keyPrefix = keyPrefix;

    this.redis.on('connect', () => {
      this.connected = true;
      console.log('[Cache] Connected to Redis');
    });

    this.redis.on('error', (error) => {
      this.connected = false;
      console.error('[Cache] Redis error:', error.message);
    });

    this.redis.on('close', () => {
      this.connected = false;
    });

    // Attempt connection
    this.redis.connect().catch(() => {
      // Connection error handled by event listener
    });
  }

  private prefixKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  private tagSetKey(tag: string): string {
    return `${this.keyPrefix}tag:${tag}`;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.connected) return null;

    try {
      const result = await this.redis.get(this.prefixKey(key));
      if (!result) return null;
      return JSON.parse(result) as T;
    } catch (error) {
      console.error('[Cache] Get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, options: CacheOptions): Promise<void> {
    if (!this.connected) return;

    try {
      const prefixedKey = this.prefixKey(key);
      const serialized = JSON.stringify(value);

      // Set the value with TTL
      await this.redis.setex(prefixedKey, options.ttlSeconds, serialized);

      // Register key with tags for later invalidation
      if (options.tags && options.tags.length > 0) {
        const pipeline = this.redis.pipeline();
        for (const tag of options.tags) {
          // Add key to tag set
          pipeline.sadd(this.tagSetKey(tag), prefixedKey);
          // Set TTL on tag set (slightly longer than cache TTL)
          pipeline.expire(this.tagSetKey(tag), options.ttlSeconds + 60);
        }
        await pipeline.exec();
      }
    } catch (error) {
      console.error('[Cache] Set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.connected) return;

    try {
      await this.redis.del(this.prefixKey(key));
    } catch (error) {
      console.error('[Cache] Delete error:', error);
    }
  }

  async invalidateByTag(tag: string): Promise<number> {
    if (!this.connected) return 0;

    try {
      const tagKey = this.tagSetKey(tag);
      const keys = await this.redis.smembers(tagKey);

      if (keys.length === 0) {
        return 0;
      }

      // Delete all keys associated with this tag
      const pipeline = this.redis.pipeline();
      for (const key of keys) {
        pipeline.del(key);
      }
      // Also delete the tag set itself
      pipeline.del(tagKey);
      await pipeline.exec();

      console.log(`[Cache] Invalidated ${keys.length} keys for tag: ${tag}`);
      return keys.length;
    } catch (error) {
      console.error('[Cache] Invalidate error:', error);
      return 0;
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
 * Create the cache service based on environment variables.
 *
 * Requires: REDIS_URL
 * Falls back to no-op cache if not configured.
 */
export function createCacheService(): ICacheService {
  const redisUrl = process.env.REDIS_URL;

  // Check if caching is explicitly disabled
  if (process.env.CACHE_ENABLED === 'false') {
    console.log('[Cache] Caching disabled via CACHE_ENABLED=false');
    return new NoOpCacheService();
  }

  // Use Redis (ElastiCache in production, Docker Redis locally)
  if (redisUrl) {
    console.log('[Cache] Using Redis:', redisUrl.replace(/\/\/.*@/, '//*****@'));
    return new IoRedisCacheService(redisUrl);
  }

  // No Redis configured - use no-op
  console.log('[Cache] No Redis configured, caching disabled');
  return new NoOpCacheService();
}

// Singleton instance
let cacheServiceInstance: ICacheService | null = null;

/**
 * Get the singleton cache service instance.
 * Creates the service on first call.
 */
export function getCacheService(): ICacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = createCacheService();
  }
  return cacheServiceInstance;
}
