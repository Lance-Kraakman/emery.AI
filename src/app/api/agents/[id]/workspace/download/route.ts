/**
 * Agent Workspace Download API
 *
 * GET /api/agents/[id]/workspace/download
 * HEAD /api/agents/[id]/workspace/download
 *
 * GET: Streams the agent's workspace as tar.gz archive from EFS.
 * HEAD: Returns metadata (Last-Modified, Content-Length) without body.
 *
 * Creates tar.gz on-the-fly from EFS filesystem.
 *
 * Authentication: withAuthenticatedRoute (session or API key)
 * Authorization: Agent must exist and belong to the user's organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { access, stat } from 'fs/promises';
import { join } from 'path';
import { PassThrough } from 'stream';
import archiver from 'archiver';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getAgentApplicationService, contextManager } from '@/ddd/application/di/container';
import { AgentId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

// Base path for workspace storage (EFS mount)
const WORKSPACE_BASE = process.env.WORKSPACE_STORAGE_PATH || '/mnt/storage/workspaces';

/**
 * Slugify agent name for use in filename.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Get the most recent modification time in a directory recursively.
 */
async function getLastModified(dirPath: string): Promise<Date | null> {
  const { readdir, stat: fsStat } = await import('fs/promises');
  let latest: Date | null = null;

  async function walk(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        try {
          const stats = await fsStat(fullPath);
          if (stats.isFile()) {
            if (!latest || stats.mtime > latest) {
              latest = stats.mtime;
            }
          } else if (stats.isDirectory()) {
            await walk(fullPath);
          }
        } catch {
          // Skip inaccessible files
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  await walk(dirPath);
  return latest;
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

    // Get workspace path on EFS
    // Directory structure: /{org_id}/agents/{agent_id}/
    const orgId = agent.organizationId.value;
    const workspacePath = join(WORKSPACE_BASE, String(orgId), 'agents', String(agentId));

    // Check workspace exists
    try {
      await access(workspacePath);
    } catch {
      return Response.json(
        { success: false, error: 'No workspace found for this agent. Run a task first to create one.' },
        { status: 404 }
      );
    }

    // Get last modified time for caching headers
    const lastModified = await getLastModified(workspacePath);
    const filename = `${slugify(agent.name)}-workspace.tar.gz`;

    // Create archive stream
    const passThrough = new PassThrough();
    const archive = archiver('tar', {
      gzip: true,
      gzipOptions: { level: 6 }
    });

    // Pipe archive to passthrough stream
    archive.pipe(passThrough);

    // Add workspace directory contents to archive
    archive.directory(workspacePath, false);

    // Finalize archive (async)
    archive.finalize().catch((err) => {
      console.error('[WORKSPACE-DOWNLOAD] Archive error:', err);
      passThrough.destroy(err);
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-cache',
    };

    if (lastModified) {
      headers['Last-Modified'] = lastModified.toUTCString();
    }

    // Stream the archive to response
    // @ts-expect-error - Node PassThrough is compatible with Response body
    return new NextResponse(passThrough, { status: 200, headers });
  } catch (error) {
    console.error('[WORKSPACE-DOWNLOAD] Error:', error);
    return Response.json(
      { success: false, error: 'Failed to download workspace' },
      { status: 500 }
    );
  }
}

/**
 * HEAD handler - Returns metadata without downloading the archive.
 * Used by Tauri to check remote modification time for sync status.
 */
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    // Authenticate
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.user) {
      return new Response(null, { status: 401 });
    }

    const { id } = await params;
    const agentId = parseInt(id, 10);
    if (isNaN(agentId)) {
      return new Response(null, { status: 400 });
    }

    if (!authResult.user.organizationId) {
      return new Response(null, { status: 400 });
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
      return new Response(null, { status: 404 });
    }

    // Get workspace path on EFS
    const orgId = agent.organizationId.value;
    const workspacePath = join(WORKSPACE_BASE, String(orgId), 'agents', String(agentId));

    // Check workspace exists
    try {
      await access(workspacePath);
    } catch {
      return new Response(null, { status: 404 });
    }

    // Get last modified time
    const lastModified = await getLastModified(workspacePath);

    const headers: Record<string, string> = {
      'Content-Type': 'application/gzip',
    };

    if (lastModified) {
      headers['Last-Modified'] = lastModified.toUTCString();
    }

    // Note: Content-Length not available without creating archive
    // Clients should use delta sync for size-aware transfers

    return new Response(null, { status: 200, headers });
  } catch (error) {
    console.error('[WORKSPACE-HEAD] Error:', error);
    return new Response(null, { status: 500 });
  }
}
