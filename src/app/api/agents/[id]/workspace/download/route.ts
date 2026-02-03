/**
 * Agent Workspace Download API
 *
 * GET /api/agents/[id]/workspace/download
 *
 * Streams the agent's workspace tar.gz archive from S3.
 * Workspace is written by the Python WorkspaceSync service after each task execution.
 *
 * Authentication: withAuthenticatedRoute (session or API key)
 * Authorization: Agent must exist and belong to the user's organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getAgentApplicationService } from '@/ddd/application/di/container';
import { AgentId } from '@/ddd/domain/shared/value-objects';
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

    // Verify agent exists and belongs to user's organization
    const agentService = getAgentApplicationService();
    const agent = await agentService.getAgent(AgentId.fromNumber(agentId));

    if (!agent) {
      return Response.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Check workspace exists in S3
    const exists = await WorkspaceS3Service.exists(agentId);
    if (!exists) {
      return Response.json(
        { success: false, error: 'No workspace found for this agent. Run a task first to create one.' },
        { status: 404 }
      );
    }

    // Stream the archive from S3
    const { body, contentLength, lastModified } = await WorkspaceS3Service.downloadArchive(agentId);
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
