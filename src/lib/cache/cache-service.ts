/**
 * Distributed Cache Service
 *
 * Redis-backed caching layer supporting both Upstash (production)
 * and ioredis (local Docker development).
 *
 * Features:
 * - Get/Set/Delete operations with TTL
 * - Tag-based invalidation for cache groups
 * - Graceful degradation when Redis unavailable
 */

import { Redis as UpstashRedis } from '@upstash/redis';
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
 * Upstash Redis cache service for production.
 * Uses REST API, works from edge functions and serverless.
 */
export class UpstashCacheService implements ICacheService {
  private readonly redis: UpstashRedis;
  private readonly keyPrefix: string;
  private connected: boolean = true;

  constructor(url: string, token: string, keyPrefix: string = 'emery:') {
    this.redis = new UpstashRedis({
      url,
      token,
    });
    this.keyPrefix = keyPrefix;
  }

  private prefixKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  private tagSetKey(tag: string): string {
    return `${this.keyPrefix}tag:${tag}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const result = await this.redis.get<T>(this.prefixKey(key));
      return result;
    } catch (error) {
      console.error('[Cache] Get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, options: CacheOptions): Promise<void> {
    try {
      const prefixedKey = this.prefixKey(key);

      // Set the value with TTL
      await this.redis.set(prefixedKey, value, {
        ex: options.ttlSeconds,
      });

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
    try {
      await this.redis.del(this.prefixKey(key));
    } catch (error) {
      console.error('[Cache] Delete error:', error);
    }
  }

  async invalidateByTag(tag: string): Promise<number> {
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
}

/**
 * ioredis cache service for local Docker development.
 * Uses native Redis protocol for lower latency.
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
 * Create the appropriate cache service based on environment variables.
 *
 * Priority:
 * 1. Upstash Redis (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
 * 2. Local Redis (REDIS_URL)
 * 3. No-op cache (fallback)
 */
export function createCacheService(): ICacheService {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const redisUrl = process.env.REDIS_URL;

  // Check if caching is explicitly disabled
  if (process.env.CACHE_ENABLED === 'false') {
    console.log('[Cache] Caching disabled via CACHE_ENABLED=false');
    return new NoOpCacheService();
  }

  // Prefer Upstash for production
  if (upstashUrl && upstashToken) {
    console.log('[Cache] Using Upstash Redis');
    return new UpstashCacheService(upstashUrl, upstashToken);
  }

  // Fall back to local Redis for development
  if (redisUrl) {
    console.log('[Cache] Using local Redis:', redisUrl);
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
