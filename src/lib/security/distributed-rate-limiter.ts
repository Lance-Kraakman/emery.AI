/**
 * Distributed Rate Limiter
 *
 * Redis-backed rate limiter using Upstash Ratelimit for production
 * and ioredis for local development.
 *
 * SECURITY: Provides DoS protection that works across multiple ECS containers.
 *
 * Features:
 * - Sliding window algorithm for accurate rate limiting
 * - Works with Upstash (production) or local Redis (development)
 * - Fallback to in-memory rate limiting when Redis unavailable
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis as UpstashRedis } from '@upstash/redis';
import Redis from 'ioredis';

// Re-export types from the original rate limiter for compatibility
export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

// Re-export the existing configs and helpers
export { RATE_LIMITS, getRateLimitForPath, getRateLimitIdentifier } from './rate-limiter';

/**
 * In-memory fallback store when Redis is unavailable
 */
interface FallbackEntry {
  count: number;
  resetAt: number;
}

const fallbackStore = new Map<string, FallbackEntry>();
let lastCleanup = Date.now();

function fallbackCheckRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();

  // Cleanup every minute
  if (now - lastCleanup > 60000) {
    lastCleanup = now;
    for (const [key, entry] of fallbackStore.entries()) {
      if (entry.resetAt < now) {
        fallbackStore.delete(key);
      }
    }
  }

  const entry = fallbackStore.get(identifier);

  if (!entry || entry.resetAt < now) {
    fallbackStore.set(identifier, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.limit - 1,
      resetAt: now + config.windowMs,
    };
  }

  if (entry.count >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Upstash Ratelimit instance cache
 * We cache instances per window size for efficiency
 */
const upstashRateLimiters = new Map<number, Ratelimit>();

function getUpstashRateLimiter(windowMs: number, limit: number): Ratelimit {
  const key = windowMs;
  let ratelimiter = upstashRateLimiters.get(key);

  if (!ratelimiter) {
    const redis = new UpstashRedis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    // Convert windowMs to duration string
    const windowSec = Math.floor(windowMs / 1000);
    const duration = `${windowSec} s` as `${number} s`;

    ratelimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, duration),
      prefix: 'emery:ratelimit',
      analytics: true,
    });

    upstashRateLimiters.set(key, ratelimiter);
  }

  return ratelimiter;
}

/**
 * ioredis-based rate limiter for local development
 */
let ioRedisClient: Redis | null = null;
let ioRedisConnected = false;

function getIoRedisClient(): Redis | null {
  if (ioRedisClient) return ioRedisClient;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  ioRedisClient = new Redis(redisUrl, {
    retryStrategy: (times) => {
      if (times > 3) return null;
      return Math.min(times * 100, 3000);
    },
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  ioRedisClient.on('connect', () => {
    ioRedisConnected = true;
  });

  ioRedisClient.on('error', () => {
    ioRedisConnected = false;
  });

  ioRedisClient.on('close', () => {
    ioRedisConnected = false;
  });

  ioRedisClient.connect().catch(() => {
    // Connection error handled by event listener
  });

  return ioRedisClient;
}

async function ioRedisCheckRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getIoRedisClient();
  if (!redis || !ioRedisConnected) {
    return fallbackCheckRateLimit(identifier, config);
  }

  const key = `emery:ratelimit:${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  try {
    // Use Redis sorted set for sliding window
    // Members are timestamps, scores are also timestamps
    const pipeline = redis.pipeline();

    // Remove expired entries
    pipeline.zremrangebyscore(key, 0, windowStart);
    // Count current entries
    pipeline.zcard(key);
    // Add current request
    pipeline.zadd(key, now, `${now}:${Math.random()}`);
    // Set expiry
    pipeline.pexpire(key, config.windowMs);

    const results = await pipeline.exec();
    if (!results) {
      return fallbackCheckRateLimit(identifier, config);
    }

    const count = (results[1]?.[1] as number) || 0;

    if (count >= config.limit) {
      // Get oldest entry to calculate reset time
      const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
      const oldestTime = oldest.length >= 2 ? parseInt(oldest[1], 10) : now;
      const resetAt = oldestTime + config.windowMs;

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.ceil((resetAt - now) / 1000),
      };
    }

    return {
      allowed: true,
      remaining: config.limit - count - 1,
      resetAt: now + config.windowMs,
    };
  } catch (error) {
    console.error('[RateLimit] Redis error, falling back to in-memory:', error);
    return fallbackCheckRateLimit(identifier, config);
  }
}

/**
 * Check if a request is allowed under rate limiting.
 *
 * Uses:
 * 1. Upstash Ratelimit if UPSTASH_REDIS_REST_URL is configured
 * 2. ioredis if REDIS_URL is configured
 * 3. In-memory fallback otherwise
 */
export async function checkDistributedRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const redisUrl = process.env.REDIS_URL;

  // Prefer Upstash for production
  if (upstashUrl && upstashToken) {
    try {
      const ratelimiter = getUpstashRateLimiter(config.windowMs, config.limit);
      const result = await ratelimiter.limit(identifier);

      return {
        allowed: result.success,
        remaining: result.remaining,
        resetAt: result.reset,
        retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
      };
    } catch (error) {
      console.error('[RateLimit] Upstash error, falling back to in-memory:', error);
      return fallbackCheckRateLimit(identifier, config);
    }
  }

  // Try local Redis for development
  if (redisUrl) {
    return ioRedisCheckRateLimit(identifier, config);
  }

  // Fallback to in-memory
  return fallbackCheckRateLimit(identifier, config);
}

/**
 * Determine which rate limiting backend is active
 */
export function getRateLimitBackend(): 'upstash' | 'ioredis' | 'memory' {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return 'upstash';
  }
  if (process.env.REDIS_URL && ioRedisConnected) {
    return 'ioredis';
  }
  return 'memory';
}
