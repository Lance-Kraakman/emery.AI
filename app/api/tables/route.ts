// AIDEV-NOTE: Force dynamic rendering to prevent build-time database connections
export const dynamic = 'force-dynamic';

/**
 * Table management API endpoint using domain repositories
 * Migrated from legacy dynamic.ts to domain-driven architecture
 */

import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getDynamicTableRepository } from "@/ddd/application/di/container";
import type { CreateDynamicTableData } from '@/app/actions/types';
import { slugify } from '@/utils/slugify';

/**
 * Create a new table using domain repository
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

    // Use domain repository for table creation
    const dynamicTableRepository = getDynamicTableRepository();
    
    const tableData: CreateDynamicTableData = {
      name,
      dbName: slugify(name),
      databaseId: parseInt(databaseId),
      organizationId: organizationId ? parseInt(organizationId) : 1,
      createdBy: userId,
      metadata: description ? { description } : undefined,
    };

    const newTable = await dynamicTableRepository.create(tableData);
    console.log(`[API-TABLES] Created table using domain repository: ${newTable.dbName}`);

    return Response.json({
      success: true,
      message: 'Table created successfully',
      table: newTable,
      id: newTable.id, // For compatibility with tests
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
 * Get tables list using domain repository
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

    // Use domain repository for table listing
    const dynamicTableRepository = getDynamicTableRepository();
    const userTables = await dynamicTableRepository.findByOrganization(authResult.user.organizationId);

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
