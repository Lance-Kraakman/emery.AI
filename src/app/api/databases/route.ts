/**
 * Database management API endpoint
 */

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute, parseJsonBody } from '@/lib/api/base';
import { hasPermission } from '@/lib/auth';
import { logAgentMutation } from '@/lib/api/agent-context';
import { getDatabaseApplicationService } from '@/ddd/application/di/container';

/**
 * GET /api/databases - List databases
 */
export async function GET(request: NextRequest): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    if (!user.organizationId || !await hasPermission(user.id, 'database:view', user.organizationId)) {
      return { success: false, error: 'Permission denied', status: 403 };
    }

    const databaseService = getDatabaseApplicationService();
    const databases = await databaseService.getDatabases({
      organizationId: user.organizationId
    });

    return { success: true, data: databases };
  });
}

/**
 * POST /api/databases - Create a new database
 */
export async function POST(request: NextRequest): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    if (!user.organizationId || !await hasPermission(user.id, 'database:create', user.organizationId)) {
      return { success: false, error: 'Permission denied', status: 403 };
    }

    const body = await parseJsonBody(request);
    if (!body?.name) {
      return { success: false, error: 'Database name is required', status: 400 };
    }

    const databaseService = getDatabaseApplicationService();
    const result = await databaseService.createDatabase({
      name: body.name,
      description: body.description,
      organizationId: user.organizationId,
      ownerId: user.id,
      metadata: body.metadata
    });

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to create database', status: 400 };
    }

    logAgentMutation(request, user, {
      action: 'create',
      resourceType: 'database',
      resourceId: String(result.data?.id),
      resourceName: body.name,
    });

    return { success: true, data: result.data, message: 'Database created successfully' };
  });
}
