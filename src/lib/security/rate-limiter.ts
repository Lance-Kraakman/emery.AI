/**
 * In-Memory Rate Limiter
 *
 * Simple sliding window rate limiter for Edge middleware.
 * Uses a Map to track request counts per identifier.
 *
 * SECURITY: Provides basic DoS protection for API routes.
 * NOTE: For distributed deployments, upgrade to Redis-based rate limiting.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Store for rate limit entries (IP/user -> entry)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically (runs on each check)
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60000; // 1 minute

function cleanupOldEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitConfig {
  // Max requests per window
  limit: number;
  // Window duration in milliseconds
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

/**
 * Check if a request is allowed under rate limiting
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupOldEntries();

  const now = Date.now();
  const key = identifier;
  const entry = rateLimitStore.get(key);

  // If no entry or window expired, create new entry
  if (!entry || entry.resetAt < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + config.windowMs
    };
    rateLimitStore.set(key, newEntry);

    return {
      allowed: true,
      remaining: config.limit - 1,
      resetAt: newEntry.resetAt
    };
  }

  // Check if limit exceeded
  if (entry.count >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000)
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    allowed: true,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt
  };
}

/**
 * Rate limit configurations for different route types
 */
export const RATE_LIMITS = {
  // Standard API routes: 100 req/min
  api: { limit: 100, windowMs: 60000 },

  // Auth routes: 10 req/min (prevent brute force)
  auth: { limit: 10, windowMs: 60000 },

  // Chat/streaming: 30 req/min (expensive operations)
  chat: { limit: 30, windowMs: 60000 },

  // File operations: 20 req/min
  files: { limit: 20, windowMs: 60000 },

  // Admin routes: 30 req/min
  admin: { limit: 30, windowMs: 60000 },

  // Webhooks: 60 req/min (external services may be bursty)
  webhooks: { limit: 60, windowMs: 60000 },

  // Public routes: 200 req/min (higher limit for public apps)
  public: { limit: 200, windowMs: 60000 }
} as const;

/**
 * Get the appropriate rate limit config for a path
 */
export function getRateLimitForPath(pathname: string): RateLimitConfig {
  if (pathname.startsWith('/api/auth')) {
    return RATE_LIMITS.auth;
  }
  if (pathname.startsWith('/api/chat') || pathname.includes('/stream')) {
    return RATE_LIMITS.chat;
  }
  if (pathname.startsWith('/api/files')) {
    return RATE_LIMITS.files;
  }
  if (pathname.startsWith('/api/admin')) {
    return RATE_LIMITS.admin;
  }
  if (pathname.startsWith('/api/webhooks')) {
    return RATE_LIMITS.webhooks;
  }
  if (pathname.startsWith('/public/')) {
    return RATE_LIMITS.public;
  }
  if (pathname.startsWith('/api/')) {
    return RATE_LIMITS.api;
  }

  // Default for non-API routes (pages) - no rate limiting
  return { limit: 1000, windowMs: 60000 };
}

/**
 * Get identifier for rate limiting (IP or user ID)
 */
export function getRateLimitIdentifier(
  ip: string | null,
  userId: string | null,
  pathname: string
): string {
  // Use user ID if authenticated, otherwise IP
  const id = userId || ip || 'unknown';
  // Prefix with route type for separate buckets
  const prefix = pathname.startsWith('/api/auth') ? 'auth:'
    : pathname.startsWith('/api/chat') ? 'chat:'
    : pathname.startsWith('/api/files') ? 'files:'
    : pathname.startsWith('/api/') ? 'api:'
    : 'page:';

  return `${prefix}${id}`;
}
