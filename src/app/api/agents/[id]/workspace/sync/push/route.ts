/**
 * Agent Workspace Delta Push API
 *
 * POST /api/agents/[id]/workspace/sync/push
 *
 * Receives changed files from client and writes them directly to the workspace.
 * Only changed files are sent, not the entire archive.
 *
 * Writes directly to shared filesystem (EFS/NFS).
 *
 * Request body:
 * {
 *   files: { [path]: base64Content },
 *   deleted: string[]  // paths to delete
 * }
 *
 * Authentication: API key or session
 * Authorization: Agent must belong to user's organization
 */

import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { mkdir, readFile, writeFile, unlink, access } from 'fs/promises';
import { join, dirname } from 'path';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getAgentApplicationService, contextManager } from '@/ddd/application/di/container';
import { AgentId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import { walkDirectory } from '../utils';
import type { FileHash, SignatureManifest } from '../../signatures/route';

// Base path for workspace storage (EFS mount)
const WORKSPACE_BASE = process.env.WORKSPACE_STORAGE_PATH || '/mnt/storage/workspaces';

interface PushRequest {
  files: Record<string, string>;  // path -> base64 content
  deleted: string[];              // paths to delete
}

// Maximum total upload size: 50MB
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;

/**
 * Validate and sanitize a file path to prevent path traversal attacks.
 * Returns null if path is invalid/dangerous.
 */
function sanitizePath(path: string): string | null {
  // Reject empty paths
  if (!path || path.trim() === '') return null;

  // Normalize and check for traversal
  const normalized = path.replace(/\\/g, '/');

  // Reject paths with traversal attempts
  if (normalized.includes('..') || normalized.startsWith('/') || normalized.includes('//')) {
    return null;
  }

  // Reject hidden files at root level (security)
  if (normalized.startsWith('.')) return null;

  return normalized;
}

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
    const body: PushRequest = await request.json();
    if (!body.files && !body.deleted) {
      return Response.json(
        { success: false, error: 'No files to sync' },
        { status: 400 }
      );
    }

    // Get workspace path on shared filesystem
    // Directory structure: /{org_id}/agents/{agent_id}/
    const orgId = agent.organizationId.value;
    const workspacePath = join(WORKSPACE_BASE, String(orgId), 'agents', String(agentId));

    // Ensure workspace directory exists
    await mkdir(workspacePath, { recursive: true });

    // Apply changes
    const filesAdded: string[] = [];
    const filesUpdated: string[] = [];
    const filesDeleted: string[] = [];

    // Delete files
    if (body.deleted) {
      for (const rawPath of body.deleted) {
        const path = sanitizePath(rawPath);
        if (!path) continue; // Skip invalid paths

        const fullPath = join(workspacePath, path);
        try {
          await unlink(fullPath);
          filesDeleted.push(path);
        } catch {
          // File might not exist, that's okay
        }
      }
    }

    // Add/update files
    if (body.files) {
      let totalSize = 0;

      for (const [rawPath, base64Content] of Object.entries(body.files)) {
        const path = sanitizePath(rawPath);
        if (!path) {
          console.warn('[WORKSPACE-PUSH] Skipping invalid path:', rawPath);
          continue;
        }

        let content: Buffer;
        try {
          content = Buffer.from(base64Content, 'base64');
        } catch {
          console.warn('[WORKSPACE-PUSH] Invalid base64 for path:', path);
          continue;
        }

        totalSize += content.length;

        if (totalSize > MAX_UPLOAD_SIZE) {
          return Response.json(
            { success: false, error: `Total upload size exceeds ${MAX_UPLOAD_SIZE / 1024 / 1024}MB limit` },
            { status: 413 }
          );
        }

        const fullPath = join(workspacePath, path);
        const dir = dirname(fullPath);
        await mkdir(dir, { recursive: true });

        // Check if file exists to determine if it's add or update
        let fileExists = false;
        try {
          await access(fullPath);
          fileExists = true;
        } catch {
          // File doesn't exist
        }

        await writeFile(fullPath, content);

        if (fileExists) {
          filesUpdated.push(path);
        } else {
          filesAdded.push(path);
        }
      }
    }

    // Compute new signatures for all files
    const allFiles = await walkDirectory(workspacePath);
    const fileHashes: Record<string, FileHash> = {};

    for (const relativePath of allFiles) {
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
      result: {
        filesAdded,
        filesUpdated,
        filesDeleted,
      },
      signatures: {
        files: fileHashes,
        timestamp: Date.now(),
      } satisfies SignatureManifest,
    });
  } catch (error) {
    console.error('[WORKSPACE-PUSH] Error:', error);
    return Response.json(
      { success: false, error: 'Failed to push workspace changes' },
      { status: 500 }
    );
  }
}
