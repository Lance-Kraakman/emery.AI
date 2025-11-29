export const dynamic = 'force-dynamic';

/**
 * Database List API Endpoint
 *
 * RESTful endpoints for database operations:
 * - GET: List databases for organization
 * - POST: Create new database
 *
 * AIDEV-NOTE: Created to support Python CRUD tools calling emery-read-database etc.
 */

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute, parseJsonBody } from '@/lib/api/base';
import { getDatabaseApplicationService } from '@/ddd/application/di/container';

/**
 * GET /api/databases
 * List databases for the authenticated user's organization
 */
export async function GET(request: NextRequest): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    if (!user.organizationId) {
      return { success: false, error: 'Organization ID required', status: 400 };
    }

    const databaseService = getDatabaseApplicationService();

    const databases = await databaseService.getDatabases({
      organizationId: user.organizationId
    });

    return {
      success: true,
      data: databases
    };
  });
}

/**
 * POST /api/databases
 * Create a new database
 *
 * Request body:
 * {
 *   name: string,
 *   description?: string,
 *   metadata?: Record<string, any>
 * }
 */
export async function POST(request: NextRequest): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    if (!user.organizationId) {
      return { success: false, error: 'Organization ID required', status: 400 };
    }

    const body = await parseJsonBody(request);

    if (!body) {
      return {
        success: false,
        error: 'Invalid request body',
        status: 400
      };
    }

    if (!body.name) {
      return {
        success: false,
        error: 'Database name is required',
        status: 400
      };
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
      return {
        success: false,
        error: result.error || 'Failed to create database',
        status: 400
      };
    }

    return {
      success: true,
      data: result.data,
      message: 'Database created successfully'
    };
  });
}
