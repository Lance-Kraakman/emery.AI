/**
 * Distributed Rate Limiter
 *
 * Edge Runtime compatible rate limiter using Upstash Ratelimit.
 *
 * SECURITY: Provides DoS protection that works across multiple ECS containers.
 *
 * Requires:
 * - UPSTASH_REDIS_REST_URL
 * - UPSTASH_REDIS_REST_TOKEN
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis as UpstashRedis } from '@upstash/redis';

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
 * Upstash Redis client (singleton)
 */
let redis: UpstashRedis | null = null;

function getRedis(): UpstashRedis {
  if (!redis) {
    redis = new UpstashRedis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

/**
 * Upstash Ratelimit instance cache
 * We cache instances per window size for efficiency
 */
const rateLimiters = new Map<number, Ratelimit>();

function getRateLimiter(windowMs: number, limit: number): Ratelimit {
  const key = windowMs;
  let ratelimiter = rateLimiters.get(key);

  if (!ratelimiter) {
    const windowSec = Math.floor(windowMs / 1000);
    const duration = `${windowSec} s` as `${number} s`;

    ratelimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(limit, duration),
      prefix: 'emery:ratelimit',
      analytics: true,
    });

    rateLimiters.set(key, ratelimiter);
  }

  return ratelimiter;
}

/**
 * Check if a request is allowed under rate limiting.
 */
export async function checkDistributedRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const ratelimiter = getRateLimiter(config.windowMs, config.limit);
  const result = await ratelimiter.limit(identifier);

  return {
    allowed: result.success,
    remaining: result.remaining,
    resetAt: result.reset,
    retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
  };
}
