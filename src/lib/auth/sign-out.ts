import { signOut } from "next-auth/react";

/**
 * Secure sign-out: clears localStorage before redirecting.
 *
 * Prevents sensitive data (chat messages, auth codes, behavior patterns)
 * from persisting after logout.
 */
export function secureSignOut(callbackUrl: string = "/") {
  if (typeof window !== 'undefined') {
    localStorage.clear();
  }
  signOut({ callbackUrl });
}
