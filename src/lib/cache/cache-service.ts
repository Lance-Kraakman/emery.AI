/**
 * Distributed Cache Service
 *
 * Upstash Redis-backed caching layer.
 *
 * Features:
 * - Get/Set/Delete operations with TTL
 * - Tag-based invalidation for cache groups
 * - Graceful degradation when Redis unavailable
 *
 * Local Development: Uses SRH (Serverless Redis HTTP) from docker-compose
 * Production: Uses Upstash Redis
 */

import { Redis as UpstashRedis } from '@upstash/redis';

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
 * Upstash Redis cache service.
 * Uses REST API, works from edge functions, serverless, and local dev (via SRH).
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
 * Create the cache service based on environment variables.
 *
 * Requires: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * Falls back to no-op cache if not configured.
 */
export function createCacheService(): ICacheService {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Check if caching is explicitly disabled
  if (process.env.CACHE_ENABLED === 'false') {
    console.log('[Cache] Caching disabled via CACHE_ENABLED=false');
    return new NoOpCacheService();
  }

  // Use Upstash (production or local via SRH)
  if (upstashUrl && upstashToken) {
    console.log('[Cache] Using Upstash Redis');
    return new UpstashCacheService(upstashUrl, upstashToken);
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
