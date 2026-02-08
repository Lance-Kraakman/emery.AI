/**
 * Agent Workspace Upload API
 *
 * POST /api/agents/[id]/workspace/upload
 *
 * Uploads a tar.gz archive to S3 as the agent's workspace.
 * Used by Tauri desktop app to push local changes to remote.
 *
 * Authentication: withAuthenticatedRoute (session or API key)
 * Authorization: Agent must exist and belong to the user's organization
 */

import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getAgentApplicationService, contextManager } from '@/ddd/application/di/container';
import { AgentId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import { WorkspaceS3Service } from '@/lib/workspace/workspace-s3';

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

    // Upload to S3
    const orgId = agent.organizationId.value;
    const { lastModified } = await WorkspaceS3Service.uploadArchive(
      orgId,
      agentId,
      bytes
    );

    return Response.json({
      success: true,
      lastModified: lastModified.toISOString(),
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
