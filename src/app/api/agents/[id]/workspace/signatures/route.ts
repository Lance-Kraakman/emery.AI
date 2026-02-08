/**
 * Agent Workspace Signatures API
 *
 * GET /api/agents/[id]/workspace/signatures
 *
 * Returns SHA256 hash manifest for all files in the remote workspace.
 * Used by Tauri desktop app for delta sync - only transfer changed files.
 *
 * Authentication: API key or session
 * Authorization: Agent must belong to user's organization
 */

import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { createGunzip } from 'zlib';
import { Readable } from 'stream';
import * as tar from 'tar';
import { mkdir, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getAgentApplicationService, contextManager } from '@/ddd/application/di/container';
import { AgentId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import { WorkspaceS3Service } from '@/lib/workspace/workspace-s3';
import { walkDirectory } from '../sync/utils';

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
  const tempDir = join(tmpdir(), `workspace-sig-${randomUUID()}`);

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

    // Check if workspace exists
    const orgId = agent.organizationId.value;
    const exists = await WorkspaceS3Service.exists(orgId, agentId);
    if (!exists) {
      // Return empty manifest for new workspaces
      return Response.json({
        success: true,
        signatures: {
          files: {},
          timestamp: Date.now(),
        } satisfies SignatureManifest,
      });
    }

    // Download and extract archive
    await mkdir(tempDir, { recursive: true });
    const { body } = await WorkspaceS3Service.downloadArchive(orgId, agentId);

    // Extract tar.gz to temp directory
    await new Promise<void>((resolve, reject) => {
      const gunzip = createGunzip();
      const extract = tar.extract({ cwd: tempDir });

      Readable.from(body)
        .pipe(gunzip)
        .pipe(extract)
        .on('finish', resolve)
        .on('error', reject);
    });

    // Walk directory and compute hashes
    const files = await walkDirectory(tempDir);
    const fileHashes: Record<string, FileHash> = {};

    for (const relativePath of files) {
      const fullPath = join(tempDir, relativePath);
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
  } finally {
    // Cleanup temp directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
