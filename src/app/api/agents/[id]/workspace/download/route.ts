/**
 * Agent Workspace Download API
 *
 * GET /api/agents/[id]/workspace/download
 * HEAD /api/agents/[id]/workspace/download
 *
 * GET: Streams the agent's workspace as tar.gz archive.
 * HEAD: Returns metadata (Last-Modified, Content-Length) without body.
 *
 * TODO: Migrate to read from EFS instead of S3 for consistency with delta sync.
 * Workspaces are now written to EFS by SharedFilesystemStorage.
 *
 * Authentication: withAuthenticatedRoute (session or API key)
 * Authorization: Agent must exist and belong to the user's organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getAgentApplicationService, contextManager } from '@/ddd/application/di/container';
import { AgentId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import { WorkspaceS3Service } from '@/lib/workspace/workspace-s3';

/**
 * Slugify agent name for use in filename.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
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
    // AIDEV-NOTE: Wrap in RLS context since this route returns streaming response
    // and can't use withAuthenticatedRoute() which returns JSON
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

    // Check workspace exists in S3
    const orgId = agent.organizationId.value;
    const exists = await WorkspaceS3Service.exists(orgId, agentId);
    if (!exists) {
      return Response.json(
        { success: false, error: 'No workspace found for this agent. Run a task first to create one.' },
        { status: 404 }
      );
    }

    // Stream the archive from S3
    const { body, contentLength, lastModified } = await WorkspaceS3Service.downloadArchive(orgId, agentId);
    const filename = `${slugify(agent.name)}-workspace.tar.gz`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-cache',
    };

    if (contentLength > 0) {
      headers['Content-Length'] = contentLength.toString();
    }

    if (lastModified) {
      headers['Last-Modified'] = lastModified.toUTCString();
    }

    // Pipe S3 readable stream to response
    // @ts-expect-error - Node Readable is compatible with Response body
    return new NextResponse(body, { status: 200, headers });
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

    // Get metadata from S3
    const orgId = agent.organizationId.value;
    const metadata = await WorkspaceS3Service.getMetadata(orgId, agentId);

    if (!metadata) {
      return new Response(null, { status: 404 });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/gzip',
    };

    if (metadata.contentLength > 0) {
      headers['Content-Length'] = metadata.contentLength.toString();
    }

    if (metadata.lastModified) {
      headers['Last-Modified'] = metadata.lastModified.toUTCString();
    }

    return new Response(null, { status: 200, headers });
  } catch (error) {
    console.error('[WORKSPACE-HEAD] Error:', error);
    return new Response(null, { status: 500 });
  }
}
