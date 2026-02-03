import Redis from 'ioredis';
import { randomBytes } from 'crypto';

const DEVICE_KEY_PREFIX = 'emery:device-flow:';
const DEVICE_CODE_TTL_SECONDS = 300; // 5 minutes
const DEVICE_CODE_BYTE_LENGTH = 32;
const MIN_DEVICE_CODE_LENGTH = 32;
const MAX_DEVICE_CODE_LENGTH = 128;

let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL is required for device flow authentication');
    }
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });
  }
  return redisClient;
}

function deviceCodeKey(code: string): string {
  return `${DEVICE_KEY_PREFIX}${code}`;
}

export function isValidDeviceCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  if (code.length < MIN_DEVICE_CODE_LENGTH || code.length > MAX_DEVICE_CODE_LENGTH) return false;
  return /^[a-f0-9]+$/i.test(code);
}

export function generateDeviceCode(): string {
  return randomBytes(DEVICE_CODE_BYTE_LENGTH).toString('hex');
}

/**
 * Store a session token for a device code. Uses SET NX (only if not exists) + TTL.
 */
export async function storeDeviceSession(
  deviceCode: string,
  sessionToken: string
): Promise<boolean> {
  if (!isValidDeviceCode(deviceCode)) return false;
  if (!sessionToken) return false;

  const redis = getRedisClient();
  const key = deviceCodeKey(deviceCode);
  const result = await redis.set(key, sessionToken, 'EX', DEVICE_CODE_TTL_SECONDS, 'NX');
  return result === 'OK';
}

/**
 * Atomically retrieve and delete the session token for a device code (one-time use).
 */
export async function consumeDeviceSession(
  deviceCode: string
): Promise<string | null> {
  if (!isValidDeviceCode(deviceCode)) return null;

  const redis = getRedisClient();
  const key = deviceCodeKey(deviceCode);

  const pipeline = redis.pipeline();
  pipeline.get(key);
  pipeline.del(key);
  const results = await pipeline.exec();

  if (!results || !results[0]) return null;
  const [err, value] = results[0];
  if (err) return null;

  return (value as string) || null;
}
