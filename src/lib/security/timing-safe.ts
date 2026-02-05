/**
 * Timing-safe string comparison utilities.
 *
 * Prevents timing attacks where an attacker measures response time
 * to determine how many characters of a secret value match.
 */
import crypto from 'crypto';

/**
 * Compare two strings in constant time.
 * Returns false if either string is empty/null, or if they differ.
 */
export function timingSafeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  // crypto.timingSafeEqual requires equal-length buffers.
  // Hash both values to normalize length and avoid leaking length info.
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}
