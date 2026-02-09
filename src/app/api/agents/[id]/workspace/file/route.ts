/**
 * Agent Workspace File API
 *
 * GET /api/agents/[id]/workspace/file?path=/src/index.ts
 * PUT /api/agents/[id]/workspace/file?path=/src/index.ts
 *
 * GET: Returns file content with detected language for syntax highlighting.
 * PUT: Saves file content (for editable file types).
 *
 * Authentication: withAuthenticatedRoute (session or API key)
 * Authorization: Agent must exist and belong to the user's organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, access, stat, lstat, realpath } from 'fs/promises';
import { join, resolve, extname, basename } from 'path';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getAgentApplicationService, contextManager } from '@/ddd/application/di/container';
import { AgentId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';

// Base path for workspace storage (EFS mount)
const WORKSPACE_BASE = process.env.WORKSPACE_STORAGE_PATH || '/mnt/storage/workspaces';

// Max file size for reading (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Language detection by extension
const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.rb': 'ruby',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.xml': 'xml',
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.sql': 'sql',
  '.sh': 'bash',
  '.bash': 'bash',
  '.zsh': 'bash',
  '.fish': 'bash',
  '.ps1': 'powershell',
  '.dockerfile': 'dockerfile',
  '.toml': 'toml',
  '.ini': 'ini',
  '.env': 'plaintext',
  '.txt': 'plaintext',
  '.log': 'plaintext',
};

function getLanguageFromExtension(ext: string): string {
  return EXTENSION_LANGUAGE_MAP[ext.toLowerCase()] || 'plaintext';
}

// SECURITY: Sensitive file patterns that should not be accessible
const SENSITIVE_FILE_PATTERNS = [
  /^\.env/i,           // .env, .env.local, .env.production, etc.
  /^\.git$/i,          // .git directory
  /\.pem$/i,           // Private keys
  /\.key$/i,           // Private keys
  /^id_rsa/i,          // SSH private keys
  /^id_ed25519/i,      // SSH private keys
  /credentials\.json$/i,
  /secrets?\.(json|yaml|yml)$/i,
  /\.htpasswd$/i,
  /\.htaccess$/i,
];

function isSensitiveFile(filename: string): boolean {
  const name = basename(filename);
  return SENSITIVE_FILE_PATTERNS.some(pattern => pattern.test(name));
}

// Binary file extensions that should not be read as text
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.ico', '.svg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.exe', '.dll', '.so', '.dylib',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.webm',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.pyc', '.class', '.o', '.obj',
]);

function isBinaryFile(filename: string): boolean {
  const ext = extname(filename).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

async function validateAgentAccess(
  request: NextRequest,
  agentIdStr: string
): Promise<{
  success: boolean;
  error?: string;
  status?: number;
  workspaceRoot?: string;
  userId?: string;
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

  return { success: true, workspaceRoot, userId: authResult.user.id };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    const validation = await validateAgentAccess(request, id);

    if (!validation.success) {
      return Response.json(
        { success: false, error: validation.error },
        { status: validation.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const relativePath = searchParams.get('path');

    if (!relativePath) {
      return Response.json(
        { success: false, error: 'Path is required' },
        { status: 400 }
      );
    }

    // Resolve and validate path
    const targetPath = resolve(validation.workspaceRoot!, relativePath.replace(/^\//, ''));
    if (!targetPath.startsWith(validation.workspaceRoot!)) {
      return Response.json(
        { success: false, error: 'Invalid path' },
        { status: 400 }
      );
    }

    // SECURITY: Block access to sensitive files
    if (isSensitiveFile(relativePath)) {
      console.warn(`[WORKSPACE-FILE-GET] Blocked access to sensitive file: ${relativePath}`);
      return Response.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // SECURITY: Block binary files (they can't be read as text)
    if (isBinaryFile(relativePath)) {
      return Response.json(
        { success: false, error: 'Binary files cannot be displayed as text' },
        { status: 415 }
      );
    }

    // Check file exists and is not a symlink pointing outside workspace
    try {
      // Use lstat first to detect symlinks
      const lstats = await lstat(targetPath);

      if (lstats.isSymbolicLink()) {
        // SECURITY: Resolve symlink and verify target is within workspace
        const realTargetPath = await realpath(targetPath);
        if (!realTargetPath.startsWith(validation.workspaceRoot!)) {
          console.warn(`[WORKSPACE-FILE-GET] Symlink escape attempt: ${targetPath} -> ${realTargetPath}`);
          return Response.json(
            { success: false, error: 'Invalid path' },
            { status: 400 }
          );
        }
      }

      // Now use stat to follow symlinks for file checks
      const stats = await stat(targetPath);
      if (!stats.isFile()) {
        return Response.json(
          { success: false, error: 'Path is not a file' },
          { status: 400 }
        );
      }

      if (stats.size > MAX_FILE_SIZE) {
        return Response.json(
          { success: false, error: 'File too large to display' },
          { status: 413 }
        );
      }
    } catch {
      return Response.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }

    // Read file content
    const content = await readFile(targetPath, 'utf-8');
    const ext = extname(relativePath);
    const language = getLanguageFromExtension(ext);

    return Response.json({
      success: true,
      data: {
        path: relativePath,
        content,
        language,
      },
    });
  } catch (error) {
    console.error('[WORKSPACE-FILE-GET] Error:', error);
    return Response.json(
      { success: false, error: 'Failed to read file' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    const validation = await validateAgentAccess(request, id);

    if (!validation.success) {
      return Response.json(
        { success: false, error: validation.error },
        { status: validation.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const relativePath = searchParams.get('path');

    if (!relativePath) {
      return Response.json(
        { success: false, error: 'Path is required' },
        { status: 400 }
      );
    }

    // Resolve and validate path
    const targetPath = resolve(validation.workspaceRoot!, relativePath.replace(/^\//, ''));
    if (!targetPath.startsWith(validation.workspaceRoot!)) {
      return Response.json(
        { success: false, error: 'Invalid path' },
        { status: 400 }
      );
    }

    // SECURITY: Block writing to sensitive files
    if (isSensitiveFile(relativePath)) {
      console.warn(`[WORKSPACE-FILE-PUT] Blocked write to sensitive file: ${relativePath}`);
      return Response.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // SECURITY: Check for symlink escape and directory check
    try {
      const lstats = await lstat(targetPath);

      // Reject symlinks
      if (lstats.isSymbolicLink()) {
        const realTargetPath = await realpath(targetPath);
        if (!realTargetPath.startsWith(validation.workspaceRoot!)) {
          console.warn(`[WORKSPACE-FILE-PUT] Symlink escape attempt: ${targetPath} -> ${realTargetPath}`);
          return Response.json(
            { success: false, error: 'Invalid path' },
            { status: 400 }
          );
        }
      }

      // Reject directories
      if (lstats.isDirectory()) {
        return Response.json(
          { success: false, error: 'Cannot write to a directory' },
          { status: 400 }
        );
      }
    } catch {
      // File doesn't exist yet - that's OK for PUT (creating new file)
      // But verify parent directory exists and is within workspace
    }

    // Get content from request body
    const body = await request.json();
    const { content } = body;

    if (typeof content !== 'string') {
      return Response.json(
        { success: false, error: 'Content is required and must be a string' },
        { status: 400 }
      );
    }

    // Write file
    await writeFile(targetPath, content, 'utf-8');

    // Write sync version file to notify Tauri clients of remote changes
    const syncVersionPath = join(validation.workspaceRoot!, '.emery-sync-version');
    await writeFile(syncVersionPath, Date.now().toString(), 'utf-8');

    return Response.json({
      success: true,
      data: {
        path: relativePath,
        message: 'File saved successfully',
      },
    });
  } catch (error) {
    console.error('[WORKSPACE-FILE-PUT] Error:', error);
    return Response.json(
      { success: false, error: 'Failed to save file' },
      { status: 500 }
    );
  }
}
