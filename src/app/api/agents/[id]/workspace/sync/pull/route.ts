/**
 * Agent Workspace Delta Pull API
 *
 * POST /api/agents/[id]/workspace/sync/pull
 *
 * Compares client's file hashes with remote and returns only changed files.
 * Client sends their current signatures, server returns files that differ.
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
import { walkDirectory } from '../utils';
import type { FileHash, SignatureManifest } from '../../signatures/route';

interface PullRequest {
  signatures: Record<string, string>;  // path -> hash
}

// Maximum response size: 50MB
const MAX_RESPONSE_SIZE = 50 * 1024 * 1024;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const tempDir = join(tmpdir(), `workspace-pull-${randomUUID()}`);

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

    const orgId = agent.organizationId.value;

    // Check if workspace exists
    const exists = await WorkspaceS3Service.exists(orgId, agentId);
    if (!exists) {
      // No remote workspace - return empty
      return Response.json({
        success: true,
        files: {},
        deleted: Object.keys(clientSignatures), // All local files are "deleted" remotely
        signatures: {
          files: {},
          timestamp: Date.now(),
        } satisfies SignatureManifest,
      });
    }

    // Download and extract archive
    await mkdir(tempDir, { recursive: true });
    const { body: archiveBody } = await WorkspaceS3Service.downloadArchive(orgId, agentId);

    await new Promise<void>((resolve, reject) => {
      const gunzip = createGunzip();
      const extract = tar.extract({ cwd: tempDir });

      Readable.from(archiveBody)
        .pipe(gunzip)
        .pipe(extract)
        .on('finish', resolve)
        .on('error', reject);
    });

    // Walk remote files and compute hashes
    const remoteFiles = await walkDirectory(tempDir);
    const remoteHashes: Record<string, FileHash> = {};
    const changedFiles: Record<string, string> = {};  // path -> base64 content
    let totalSize = 0;

    for (const relativePath of remoteFiles) {
      const fullPath = join(tempDir, relativePath);
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
  } finally {
    // Cleanup temp directory
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
