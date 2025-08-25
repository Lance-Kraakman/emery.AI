// AIDEV-NOTE: Force dynamic rendering to prevent build-time database connections
export const dynamic = 'force-dynamic';

/**
 * Table management API endpoint using TableApplicationService
 * Migrated from legacy dynamic.ts to domain-driven architecture
 */

import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getTableApplicationService } from "@/ddd/application/di/container";
import type { CreateTableCommand } from '@/ddd/application/services/tables/table-application-service';

/**
 * Create a new table using TableApplicationService
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const authResult = await authenticateRequest(request);
    
    if (!authResult.success || !authResult.user) {
      return Response.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.user.id;
    const body = await request.json();
    const { name, description, organizationId, databaseId } = body;

    if (!name) {
      return Response.json({ 
        error: 'Missing required field: name' 
      }, { status: 400 });
    }

    if (!databaseId) {
      return Response.json({ 
        error: 'Missing required field: databaseId' 
      }, { status: 400 });
    }

    // Use TableApplicationService for table creation
    const tableApplicationService = getTableApplicationService();
    
    const command: CreateTableCommand = {
      name,
      databaseId: parseInt(databaseId),
      organizationId: organizationId ? parseInt(organizationId) : 1,
      createdBy: userId,
      description,
      metadata: {}
    };

    const result = await tableApplicationService.createTable(command);

    if (!result.success) {
      return Response.json({ 
        success: false,
        error: result.error || 'Failed to create table'
      }, { status: 400 });
    }

    console.log(`[API-TABLES] Created table using TableApplicationService: ${result.data?.dbName}`);

    return Response.json({
      success: true,
      message: 'Table created successfully',
      table: result.data,
      id: result.data?.id, // For compatibility with tests
    });

  } catch (error) {
    console.error('Error creating table:', error);
    return Response.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}

/**
 * Get tables list using TableApplicationService
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const authResult = await authenticateRequest(request);
    
    if (!authResult.success || !authResult.user) {
      return Response.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    // Get tables for user's current organization
    if (!authResult.user.organizationId) {
      return Response.json({ 
        success: false, 
        error: 'User has no current organization' 
      }, { status: 400 });
    }

    // Use TableApplicationService for table listing
    const tableApplicationService = getTableApplicationService();
    const userTables = await tableApplicationService.getTablesForOrganization(authResult.user.organizationId);

    return Response.json({
      success: true,
      tables: userTables,
    });

  } catch (error) {
    console.error('Error fetching tables:', error);
    return Response.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
