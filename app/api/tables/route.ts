/**
 * Table management API endpoint
 * Supports REST API access for table operations
 */

import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { db } from '@/lib/db/client';
import { tables } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createDynamicTable } from '@/lib/db/dynamic';

/**
 * Create a new table
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const authResult = await authenticateRequest(request);
    
    if (!authResult.success || !authResult.user) {
      return Response.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.user.id;

    const body = await request.json();
    const { name, description, organizationId } = body;

    if (!name) {
      return Response.json({ 
        error: 'Missing required field: name' 
      }, { status: 400 });
    }


    // Generate database table name
    const dbName = `table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create table record in metadata
    const [newTable] = await db.insert(tables).values({
      name,
      dbName,
      organizationId: organizationId ? parseInt(organizationId) : 1, // Default to org 1
      createdBy: userId,
    }).returning();

    // Create the actual dynamic table
    try {
      await createDynamicTable(newTable.dbName);
      console.log(`[API-TABLES] Created dynamic table: ${newTable.dbName}`);
    } catch (tableError) {
      console.error(`[API-TABLES] Failed to create dynamic table:`, tableError);
      // Delete the metadata record if dynamic table creation fails
      await db.delete(tables).where(eq(tables.id, newTable.id));
      throw new Error('Failed to create dynamic table structure');
    }

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
 * Get tables list
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const authResult = await authenticateRequest(request);
    
    if (!authResult.success || !authResult.user) {
      return Response.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.user.id;

    // Get tables for user's current organization
    if (!authResult.user.organizationId) {
      return Response.json({ 
        success: false, 
        error: 'User has no current organization' 
      }, { status: 400 });
    }

    const userTables = await db
      .select()
      .from(tables)
      .where(eq(tables.organizationId, authResult.user.organizationId));

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