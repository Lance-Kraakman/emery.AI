/**
 * User SSH Keys API
 *
 * POST /api/user/ssh-keys - Register a new SSH public key
 * GET /api/user/ssh-keys - List user's SSH keys
 * DELETE /api/user/ssh-keys?fingerprint=xxx - Delete a key by fingerprint
 *
 * Used by Tauri desktop app to register SSH keys for rsync workspace sync.
 * Keys are synced to the SSH container's authorized_keys via Lambda/cron.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { db } from '@/ddd/infrastructure/db/client';
import { userSshKeys } from '@/ddd/infrastructure/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Compute SHA256 fingerprint of an SSH public key
 * Format matches ssh-keygen -lf output (e.g., SHA256:xxx)
 */
function computeFingerprint(publicKey: string): string {
  // Extract the base64 key data (middle part of "ssh-ed25519 AAAA... comment")
  const parts = publicKey.trim().split(/\s+/);
  if (parts.length < 2) {
    throw new Error('Invalid SSH public key format');
  }

  const keyData = parts[1];
  const decoded = Buffer.from(keyData, 'base64');
  const hash = createHash('sha256').update(decoded).digest('base64');

  // Remove trailing = padding for standard SSH fingerprint format
  return `SHA256:${hash.replace(/=+$/, '')}`;
}

/**
 * POST /api/user/ssh-keys - Register a new SSH public key
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return Response.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { public_key, name, organization_id } = body;

    // Use provided org_id or fall back to user's current organization
    const orgId = organization_id ?? authResult.user.organizationId;

    if (!public_key || typeof public_key !== 'string') {
      return Response.json(
        { success: false, error: 'public_key is required' },
        { status: 400 }
      );
    }

    // Validate and compute fingerprint
    let fingerprint: string;
    try {
      fingerprint = computeFingerprint(public_key);
    } catch (error) {
      return Response.json(
        { success: false, error: 'Invalid SSH public key format' },
        { status: 400 }
      );
    }

    // Check if key already exists (idempotent)
    const existing = await db
      .select()
      .from(userSshKeys)
      .where(
        and(
          eq(userSshKeys.userId, authResult.user.id),
          eq(userSshKeys.fingerprint, fingerprint)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Key already registered - return 409 Conflict but include the key info
      return Response.json(
        {
          success: true,
          data: {
            id: existing[0].id,
            fingerprint: existing[0].fingerprint,
            name: existing[0].name,
            createdAt: existing[0].createdAt,
            alreadyExists: true,
          },
        },
        { status: 409 }
      );
    }

    // Insert new key
    const [newKey] = await db
      .insert(userSshKeys)
      .values({
        userId: authResult.user.id,
        organizationId: orgId,
        publicKey: public_key.trim(),
        fingerprint,
        name: name || 'Desktop Sync',
      })
      .returning();

    console.log(`[SSH-KEYS] Registered key for user ${authResult.user.id}: ${fingerprint}`);

    return Response.json({
      success: true,
      data: {
        id: newKey.id,
        fingerprint: newKey.fingerprint,
        name: newKey.name,
        createdAt: newKey.createdAt,
      },
    });
  } catch (error) {
    console.error('[SSH-KEYS] POST error:', error);
    return Response.json(
      { success: false, error: 'Failed to register SSH key' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/user/ssh-keys - List user's SSH keys
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return Response.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const keys = await db
      .select({
        id: userSshKeys.id,
        fingerprint: userSshKeys.fingerprint,
        name: userSshKeys.name,
        lastUsedAt: userSshKeys.lastUsedAt,
        createdAt: userSshKeys.createdAt,
      })
      .from(userSshKeys)
      .where(eq(userSshKeys.userId, authResult.user.id))
      .orderBy(userSshKeys.createdAt);

    return Response.json({
      success: true,
      data: keys,
    });
  } catch (error) {
    console.error('[SSH-KEYS] GET error:', error);
    return Response.json(
      { success: false, error: 'Failed to list SSH keys' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/ssh-keys?fingerprint=xxx - Delete a key by fingerprint
 */
export async function DELETE(request: NextRequest): Promise<Response> {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return Response.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fingerprint = searchParams.get('fingerprint');

    if (!fingerprint) {
      return Response.json(
        { success: false, error: 'fingerprint query parameter is required' },
        { status: 400 }
      );
    }

    const result = await db
      .delete(userSshKeys)
      .where(
        and(
          eq(userSshKeys.userId, authResult.user.id),
          eq(userSshKeys.fingerprint, fingerprint)
        )
      )
      .returning({ id: userSshKeys.id });

    if (result.length === 0) {
      return Response.json(
        { success: false, error: 'SSH key not found' },
        { status: 404 }
      );
    }

    console.log(`[SSH-KEYS] Deleted key for user ${authResult.user.id}: ${fingerprint}`);

    return Response.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    console.error('[SSH-KEYS] DELETE error:', error);
    return Response.json(
      { success: false, error: 'Failed to delete SSH key' },
      { status: 500 }
    );
  }
}
