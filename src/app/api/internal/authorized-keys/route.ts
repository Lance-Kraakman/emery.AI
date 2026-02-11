/**
 * Internal API: Authorized Keys
 *
 * GET /api/internal/authorized-keys
 *
 * Returns all SSH public keys in OpenSSH authorized_keys format.
 * Called by SSH container's AuthorizedKeysCommand on each connection.
 *
 * Security: Uses shared secret (INTERNAL_API_SECRET) for internal service auth.
 * This endpoint is NOT for external use.
 */

import { NextRequest } from 'next/server';
import { db } from '@/ddd/infrastructure/db/client';
import { userSshKeys } from '@/ddd/infrastructure/db/schema';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    // Authenticate with internal secret
    const secret = request.headers.get('X-Internal-Secret');
    const expectedSecret = process.env.INTERNAL_API_SECRET;

    if (!expectedSecret) {
      console.error('[authorized-keys] INTERNAL_API_SECRET not configured');
      return new Response('Server misconfigured', { status: 500 });
    }

    if (secret !== expectedSecret) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Fetch all SSH keys from database
    const keys = await db
      .select({
        publicKey: userSshKeys.publicKey,
        userId: userSshKeys.userId,
        organizationId: userSshKeys.organizationId,
      })
      .from(userSshKeys);

    // Format as authorized_keys with ForceCommand for org-scoped keys
    // Format: command="...",options key_type key_data comment
    const authorizedKeys = keys
      .map((k: { publicKey: string; userId: string; organizationId: number | null }) => {
        const comment = `user_${k.userId}`;
        if (k.organizationId) {
          // Restrict to org folder with ForceCommand
          const options = `command="/usr/local/bin/restricted-rsync.sh ${k.organizationId}",no-port-forwarding,no-agent-forwarding,no-X11-forwarding`;
          return `${options} ${k.publicKey} ${comment}`;
        }
        // Legacy key without org restriction
        return `${k.publicKey} ${comment}`;
      })
      .join('\n');

    console.log(`[authorized-keys] Returning ${keys.length} keys`);

    // OpenSSH requires trailing newline for authorized_keys format
    return new Response(authorizedKeys ? authorizedKeys + '\n' : '', {
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (error) {
    console.error('[authorized-keys] Error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
