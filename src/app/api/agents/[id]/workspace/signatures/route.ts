/**
 * Agent Workspace Signatures API
 *
 * GET /api/agents/[id]/workspace/signatures
 *
 * Returns SHA256 hash manifest for all files in the workspace.
 * Used by Tauri desktop app for delta sync - only transfer changed files.
 *
 * Reads directly from shared filesystem (EFS/NFS).
 *
 * Authentication: API key or session
 * Authorization: Agent must belong to user's organization
 */

import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { readFile, stat, access } from 'fs/promises';
import { join } from 'path';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getAgentApplicationService, contextManager } from '@/ddd/application/di/container';
import { AgentId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import { walkDirectory } from '../sync/utils';

// Base path for workspace storage (EFS mount)
const WORKSPACE_BASE = process.env.WORKSPACE_STORAGE_PATH || '/mnt/storage/workspaces';

export interface FileHash {
  hash: string;  // SHA256 hex
  size: number;
}

export interface SignatureManifest {
  files: Record<string, FileHash>;
  timestamp: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    // Authenticate
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return Response.json(
        { success: false, error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const agentId = parseInt(id, 10);
    if (isNaN(agentId)) {
      return Response.json(
        { success: false, error: 'Invalid agent ID' },
        { status: 400 }
      );
    }

    if (!authResult.user.organizationId) {
      return Response.json(
        { success: false, error: 'No organization context' },
        { status: 400 }
      );
    }

    // Verify agent exists and belongs to user's organization
    const agent = await contextManager.withContext(
      OrganizationId.fromNumber(authResult.user.organizationId),
      async () => {
        const agentService = getAgentApplicationService();
        return agentService.getAgent(AgentId.fromNumber(agentId));
      },
      UserId.fromString(authResult.user.id)
    );

    if (!agent) {
      return Response.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Get workspace path on shared filesystem
    // Directory structure: /{org_id}/agents/{agent_id}/
    const orgId = agent.organizationId.value;
    const workspacePath = join(WORKSPACE_BASE, String(orgId), 'agents', String(agentId));

    // Check if workspace exists
    try {
      await access(workspacePath);
    } catch {
      // Workspace doesn't exist yet - return empty manifest
      return Response.json({
        success: true,
        signatures: {
          files: {},
          timestamp: Date.now(),
        } satisfies SignatureManifest,
      });
    }

    // Walk directory and compute hashes
    const files = await walkDirectory(workspacePath);
    const fileHashes: Record<string, FileHash> = {};

    for (const relativePath of files) {
      const fullPath = join(workspacePath, relativePath);
      const content = await readFile(fullPath);
      const hash = createHash('sha256').update(content).digest('hex');
      fileHashes[relativePath] = {
        hash,
        size: content.length,
      };
    }

    return Response.json({
      success: true,
      signatures: {
        files: fileHashes,
        timestamp: Date.now(),
      } satisfies SignatureManifest,
    });
  } catch (error) {
    console.error('[WORKSPACE-SIGNATURES] Error:', error);
    return Response.json(
      { success: false, error: 'Failed to get workspace signatures' },
      { status: 500 }
    );
  }
}
