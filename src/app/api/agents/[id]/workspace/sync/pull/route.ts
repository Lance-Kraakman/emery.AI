/**
 * Agent Workspace Delta Pull API
 *
 * POST /api/agents/[id]/workspace/sync/pull
 *
 * Compares client's file hashes with server and returns only changed files.
 * Client sends their current signatures, server returns files that differ.
 *
 * Reads directly from shared filesystem (EFS/NFS).
 *
 * Request body:
 * {
 *   signatures: { [path]: hash }
 * }
 *
 * Response:
 * {
 *   files: { [path]: base64Content },  // changed or new files
 *   deleted: string[],                  // files that exist locally but not remote
 *   signatures: SignatureManifest       // new signatures for caching
 * }
 *
 * Authentication: API key or session
 * Authorization: Agent must belong to user's organization
 */

import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { readFile, access } from 'fs/promises';
import { join } from 'path';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getAgentApplicationService, contextManager } from '@/ddd/application/di/container';
import { AgentId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import { walkDirectory } from '../utils';
import type { FileHash, SignatureManifest } from '../../signatures/route';

// Base path for workspace storage (EFS mount)
const WORKSPACE_BASE = process.env.WORKSPACE_STORAGE_PATH || '/mnt/storage/workspaces';

interface PullRequest {
  signatures: Record<string, string>;  // path -> hash
}

// Maximum response size: 50MB
const MAX_RESPONSE_SIZE = 50 * 1024 * 1024;

export async function POST(
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

    // Parse request body
    const body: PullRequest = await request.json();
    const clientSignatures = body.signatures || {};

    // Get workspace path on shared filesystem
    const orgId = agent.organizationId.value;
    const workspacePath = join(WORKSPACE_BASE, String(orgId), String(agentId));

    // Check if workspace exists
    try {
      await access(workspacePath);
    } catch {
      // No workspace - return empty (all client files are "deleted" remotely)
      return Response.json({
        success: true,
        files: {},
        deleted: Object.keys(clientSignatures),
        signatures: {
          files: {},
          timestamp: Date.now(),
        } satisfies SignatureManifest,
      });
    }

    // Walk remote files and compute hashes
    const remoteFiles = await walkDirectory(workspacePath);
    const remoteHashes: Record<string, FileHash> = {};
    const changedFiles: Record<string, string> = {};  // path -> base64 content
    let totalSize = 0;

    for (const relativePath of remoteFiles) {
      const fullPath = join(workspacePath, relativePath);
      const content = await readFile(fullPath);
      const hash = createHash('sha256').update(content).digest('hex');

      remoteHashes[relativePath] = {
        hash,
        size: content.length,
      };

      // Check if this file differs from client's version
      const clientHash = clientSignatures[relativePath];
      if (clientHash !== hash) {
        // File is new or changed
        totalSize += content.length;
        if (totalSize > MAX_RESPONSE_SIZE) {
          return Response.json(
            { success: false, error: 'Too many changes to sync at once. Try syncing more frequently.' },
            { status: 413 }
          );
        }
        changedFiles[relativePath] = content.toString('base64');
      }
    }

    // Find deleted files (exist in client but not remote)
    const deletedFiles: string[] = [];
    for (const clientPath of Object.keys(clientSignatures)) {
      if (!remoteHashes[clientPath]) {
        deletedFiles.push(clientPath);
      }
    }

    return Response.json({
      success: true,
      files: changedFiles,
      deleted: deletedFiles,
      signatures: {
        files: remoteHashes,
        timestamp: Date.now(),
      } satisfies SignatureManifest,
    });
  } catch (error) {
    console.error('[WORKSPACE-PULL] Error:', error);
    return Response.json(
      { success: false, error: 'Failed to pull workspace changes' },
      { status: 500 }
    );
  }
}
