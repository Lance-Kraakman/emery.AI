/**
 * Agent Workspace Browse API
 *
 * GET /api/agents/[id]/workspace/browse?path=/
 *
 * Lists directory contents for the agent's workspace.
 * Returns file/directory entries with names, types, and sizes.
 *
 * Authentication: withAuthenticatedRoute (session or API key)
 * Authorization: Agent must exist and belong to the user's organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat, access, lstat, realpath } from 'fs/promises';
import { join, resolve } from 'path';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getAgentApplicationService, contextManager } from '@/ddd/application/di/container';
import { AgentId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

// Base path for workspace storage (EFS mount)
const WORKSPACE_BASE = process.env.WORKSPACE_STORAGE_PATH || '/mnt/storage/workspaces';

interface DirectoryEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
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

    // Validate organization context
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

    // Get path from query params
    const { searchParams } = new URL(request.url);
    const relativePath = searchParams.get('path') || '/';

    // Get workspace path on EFS
    const orgId = agent.organizationId.value;
    const workspaceRoot = join(WORKSPACE_BASE, String(orgId), 'agents', String(agentId));

    // Resolve the target path and ensure it's within workspace
    const targetPath = resolve(workspaceRoot, relativePath.replace(/^\//, ''));
    if (!targetPath.startsWith(workspaceRoot)) {
      return Response.json(
        { success: false, error: 'Invalid path' },
        { status: 400 }
      );
    }

    // Check workspace exists
    try {
      await access(workspaceRoot);
    } catch {
      return Response.json(
        { success: false, error: 'No workspace found for this agent' },
        { status: 404 }
      );
    }

    // Check target path exists
    try {
      await access(targetPath);
    } catch {
      return Response.json(
        { success: false, error: 'Path not found' },
        { status: 404 }
      );
    }

    // SECURITY: Check for symlink escape - resolve symlinks and verify still within workspace
    try {
      const realTargetPath = await realpath(targetPath);
      if (!realTargetPath.startsWith(workspaceRoot)) {
        console.warn(`[WORKSPACE-BROWSE] Symlink escape attempt: ${targetPath} -> ${realTargetPath}`);
        return Response.json(
          { success: false, error: 'Invalid path' },
          { status: 400 }
        );
      }
    } catch {
      // realpath fails if path doesn't exist - already handled above
    }

    // Read directory
    const entries = await readdir(targetPath, { withFileTypes: true });
    const results: DirectoryEntry[] = [];

    for (const entry of entries) {
      // Skip hidden files
      if (entry.name.startsWith('.')) continue;

      const entryPath = join(targetPath, entry.name);

      try {
        // SECURITY: Use lstat to detect symlinks, skip them to prevent escape
        const lstats = await lstat(entryPath);
        if (lstats.isSymbolicLink()) {
          // Verify symlink target is within workspace
          try {
            const realEntryPath = await realpath(entryPath);
            if (!realEntryPath.startsWith(workspaceRoot)) {
              console.warn(`[WORKSPACE-BROWSE] Skipping symlink outside workspace: ${entry.name}`);
              continue; // Skip symlinks pointing outside workspace
            }
          } catch {
            continue; // Skip broken symlinks
          }
        }

        const entryType = lstats.isDirectory() ? 'directory' : 'file';
        results.push({
          name: entry.name,
          type: entryType,
          size: lstats.isFile() ? lstats.size : undefined,
          modifiedAt: lstats.mtime.toISOString(),
        });
      } catch {
        // Skip files we can't stat
        const entryType = entry.isDirectory() ? 'directory' : 'file';
        results.push({
          name: entry.name,
          type: entryType,
        });
      }
    }

    // Sort: directories first, then alphabetically
    results.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return Response.json({
      success: true,
      data: {
        path: relativePath,
        entries: results,
      },
    });
  } catch (error) {
    console.error('[WORKSPACE-BROWSE] Error:', error);
    return Response.json(
      { success: false, error: 'Failed to browse workspace' },
      { status: 500 }
    );
  }
}
