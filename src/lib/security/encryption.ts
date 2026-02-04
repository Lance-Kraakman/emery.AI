/**
 * AES-256-GCM encryption for sensitive data at rest.
 *
 * Used by Drizzle `encryptedText` custom column type to transparently
 * encrypt OAuth tokens before storage and decrypt after retrieval.
 *
 * Key management:
 * - ENCRYPTION_KEY env var: base64-encoded 32-byte key
 * - Dev mode (NODE_ENV=development without key): passthrough, no encryption
 * - Production without key: throws immediately
 *
 * Storage format: base64(iv):base64(authTag):base64(ciphertext)
 * - 12-byte random IV (GCM standard)
 * - 16-byte auth tag (128-bit integrity check)
 * - Variable-length ciphertext
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const SEPARATOR = ':';

let _key: Buffer | null = null;
let _devMode: boolean | null = null;

function isDevMode(): boolean {
  if (_devMode === null) {
    _devMode = process.env.NODE_ENV === 'development';
  }
  return _devMode;
}

function getKey(): Buffer {
  if (_key) return _key;

  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    if (isDevMode()) {
      return Buffer.alloc(0); // sentinel for passthrough
    }
    throw new Error(
      'ENCRYPTION_KEY environment variable is required in production. ' +
      'Generate with: openssl rand -base64 32'
    );
  }

  _key = Buffer.from(raw, 'base64');
  if (_key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must be exactly 32 bytes (256 bits) when base64-decoded. Got ${_key.length} bytes.`
    );
  }
  return _key;
}

function isPassthrough(): boolean {
  return isDevMode() && !process.env.ENCRYPTION_KEY;
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns null for null/undefined input.
 * In dev mode without ENCRYPTION_KEY, returns plaintext unchanged.
 */
export function encrypt(plaintext: string | null | undefined): string | null {
  if (plaintext == null) return null;
  if (isPassthrough()) return plaintext;

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(SEPARATOR);
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 * Returns null for null/undefined input.
 * Detects plaintext (no separator pattern) and returns it unmodified —
 * safe for mixed-state data during migration from plaintext to encrypted.
 */
export function decrypt(ciphertext: string | null | undefined): string | null {
  if (ciphertext == null) return null;
  if (isPassthrough()) return ciphertext;

  // Detect plaintext (not encrypted) — lacks the 3-part separator format
  const parts = ciphertext.split(SEPARATOR);
  if (parts.length !== 3) {
    return ciphertext;
  }

  const key = getKey();
  const [ivB64, authTagB64, encryptedB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
}

/**
 * Check if a value appears to be encrypted by this module.
 * Used by the token migration script for idempotency.
 */
export function isEncrypted(value: string | null | undefined): boolean {
  if (value == null) return false;
  const parts = value.split(SEPARATOR);
  if (parts.length !== 3) return false;
  try {
    for (const part of parts) {
      Buffer.from(part, 'base64');
    }
    return true;
  } catch {
    return false;
  }
}
