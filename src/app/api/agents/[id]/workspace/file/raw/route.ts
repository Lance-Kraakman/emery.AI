/**
 * Agent Workspace Raw File API
 *
 * GET /api/agents/[id]/workspace/file/raw?path=/path/to/file.pdf
 *
 * Streams binary files (PDFs, images, etc.) with proper content-type headers.
 * Used by the workspace PDF viewer and image viewer components.
 *
 * Authentication: withAuthenticatedRoute (session or API key)
 * Authorization: Agent must exist and belong to the user's organization
 */

import { NextRequest } from 'next/server';
import { createReadStream } from 'fs';
import { stat, lstat, realpath, access } from 'fs/promises';
import { join, resolve, extname, basename } from 'path';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getAgentApplicationService, contextManager } from '@/ddd/application/di/container';
import { AgentId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import { Readable } from 'stream';

// Base path for workspace storage (EFS mount)
const WORKSPACE_BASE = process.env.WORKSPACE_STORAGE_PATH || '/mnt/storage/workspaces';

// Max file size for streaming (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// MIME type mapping
const MIME_TYPE_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
};

function getMimeType(ext: string): string {
  return MIME_TYPE_MAP[ext.toLowerCase()] || 'application/octet-stream';
}

// SECURITY: Sensitive file patterns that should not be accessible
const SENSITIVE_FILE_PATTERNS = [
  /^\.env/i,
  /^\.git$/i,
  /\.pem$/i,
  /\.key$/i,
  /^id_rsa/i,
  /^id_ed25519/i,
  /credentials\.json$/i,
  /secrets?\.(json|yaml|yml)$/i,
  /\.htpasswd$/i,
  /\.htaccess$/i,
];

function isSensitiveFile(filename: string): boolean {
  const name = basename(filename);
  return SENSITIVE_FILE_PATTERNS.some(pattern => pattern.test(name));
}

async function validateAgentAccess(
  request: NextRequest,
  agentIdStr: string
): Promise<{
  success: boolean;
  error?: string;
  status?: number;
  workspaceRoot?: string;
}> {
  const authResult = await authenticateRequest(request);
  if (!authResult.success || !authResult.user) {
    return { success: false, error: authResult.error || 'Unauthorized', status: 401 };
  }

  const agentId = parseInt(agentIdStr, 10);
  if (isNaN(agentId)) {
    return { success: false, error: 'Invalid agent ID', status: 400 };
  }

  if (!authResult.user.organizationId) {
    return { success: false, error: 'No organization context', status: 400 };
  }

  const agent = await contextManager.withContext(
    OrganizationId.fromNumber(authResult.user.organizationId),
    async () => {
      const agentService = getAgentApplicationService();
      return agentService.getAgent(AgentId.fromNumber(agentId));
    },
    UserId.fromString(authResult.user.id)
  );

  if (!agent) {
    return { success: false, error: 'Agent not found', status: 404 };
  }

  const orgId = agent.organizationId.value;
  const workspaceRoot = join(WORKSPACE_BASE, String(orgId), 'agents', String(agentId));

  try {
    await access(workspaceRoot);
  } catch {
    return { success: false, error: 'No workspace found for this agent', status: 404 };
  }

  return { success: true, workspaceRoot };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    const validation = await validateAgentAccess(request, id);

    if (!validation.success) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: validation.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { searchParams } = new URL(request.url);
    const relativePath = searchParams.get('path');

    if (!relativePath) {
      return new Response(JSON.stringify({ error: 'Path is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Resolve and validate path
    const targetPath = resolve(validation.workspaceRoot!, relativePath.replace(/^\//, ''));
    if (!targetPath.startsWith(validation.workspaceRoot!)) {
      return new Response(JSON.stringify({ error: 'Invalid path' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // SECURITY: Block access to sensitive files
    if (isSensitiveFile(relativePath)) {
      console.warn(`[WORKSPACE-FILE-RAW] Blocked access to sensitive file: ${relativePath}`);
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check file exists and is not a symlink pointing outside workspace
    try {
      const lstats = await lstat(targetPath);

      if (lstats.isSymbolicLink()) {
        const realTargetPath = await realpath(targetPath);
        if (!realTargetPath.startsWith(validation.workspaceRoot!)) {
          console.warn(`[WORKSPACE-FILE-RAW] Symlink escape attempt: ${targetPath} -> ${realTargetPath}`);
          return new Response(JSON.stringify({ error: 'Invalid path' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      const stats = await stat(targetPath);
      if (!stats.isFile()) {
        return new Response(JSON.stringify({ error: 'Path is not a file' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (stats.size > MAX_FILE_SIZE) {
        return new Response(JSON.stringify({ error: 'File too large' }), {
          status: 413,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Stream the file
      const ext = extname(relativePath);
      const mimeType = getMimeType(ext);
      const fileName = basename(relativePath);

      // Create a readable stream from the file
      const nodeStream = createReadStream(targetPath);
      const webStream = Readable.toWeb(nodeStream) as ReadableStream;

      return new Response(webStream, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': stats.size.toString(),
          'Content-Disposition': `inline; filename="${fileName}"`,
          'Cache-Control': 'private, max-age=3600',
        }
      });
    } catch {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('[WORKSPACE-FILE-RAW] Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to read file' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
