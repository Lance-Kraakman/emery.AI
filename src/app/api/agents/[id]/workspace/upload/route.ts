/**
 * Agent Workspace Upload API
 *
 * POST /api/agents/[id]/workspace/upload
 *
 * Uploads a tar.gz archive and extracts it to the agent's workspace on EFS.
 * Used by Tauri desktop app to push local changes to remote.
 *
 * Extracts directly to shared filesystem (EFS/NFS).
 *
 * Authentication: withAuthenticatedRoute (session or API key)
 * Authorization: Agent must exist and belong to the user's organization
 */

import { NextRequest } from 'next/server';
import { mkdir, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import * as tar from 'tar';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getAgentApplicationService, contextManager } from '@/ddd/application/di/container';
import { AgentId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

// Base path for workspace storage (EFS mount)
const WORKSPACE_BASE = process.env.WORKSPACE_STORAGE_PATH || '/mnt/storage/workspaces';

// Maximum workspace size: 100MB
const MAX_WORKSPACE_SIZE = 100 * 1024 * 1024;

// Gzip magic bytes
const GZIP_MAGIC = [0x1f, 0x8b];

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

    // Validate content type
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/gzip') && !contentType?.includes('application/octet-stream')) {
      return Response.json(
        { success: false, error: 'Invalid content type. Expected application/gzip' },
        { status: 400 }
      );
    }

    // Check content length before reading body
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_WORKSPACE_SIZE) {
      return Response.json(
        { success: false, error: `Workspace too large. Maximum size is ${MAX_WORKSPACE_SIZE / 1024 / 1024}MB` },
        { status: 413 }
      );
    }

    // Read the request body
    const body = await request.arrayBuffer();
    if (body.byteLength === 0) {
      return Response.json(
        { success: false, error: 'Empty request body' },
        { status: 400 }
      );
    }

    // Validate actual size (in case Content-Length was missing or wrong)
    if (body.byteLength > MAX_WORKSPACE_SIZE) {
      return Response.json(
        { success: false, error: `Workspace too large. Maximum size is ${MAX_WORKSPACE_SIZE / 1024 / 1024}MB` },
        { status: 413 }
      );
    }

    // Validate gzip magic bytes
    const bytes = new Uint8Array(body);
    if (bytes.length < 2 || bytes[0] !== GZIP_MAGIC[0] || bytes[1] !== GZIP_MAGIC[1]) {
      return Response.json(
        { success: false, error: 'Invalid gzip format' },
        { status: 400 }
      );
    }

    // Get workspace path on EFS
    // Directory structure: /{org_id}/agents/{agent_id}/
    const orgId = agent.organizationId.value;
    const workspacePath = join(WORKSPACE_BASE, String(orgId), 'agents', String(agentId));

    // Ensure workspace directory exists
    await mkdir(workspacePath, { recursive: true });

    // Write to temp file, extract, cleanup
    // (tar.extract requires a file path for gzipped archives)
    const tempFile = join(workspacePath, `.upload-${Date.now()}.tar.gz`);
    await writeFile(tempFile, Buffer.from(bytes));

    try {
      await tar.extract({ file: tempFile, cwd: workspacePath });
      await unlink(tempFile);
    } catch (err) {
      await unlink(tempFile).catch(() => {}); // cleanup on error
      throw err;
    }

    return Response.json({
      success: true,
      lastModified: new Date().toISOString(),
      size: body.byteLength,
    });
  } catch (error) {
    console.error('[WORKSPACE-UPLOAD] Error:', error);
    return Response.json(
      { success: false, error: 'Failed to upload workspace' },
      { status: 500 }
    );
  }
}
