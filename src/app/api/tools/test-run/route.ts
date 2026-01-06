/**
 * Tool Test Run API Endpoint
 *
 * Executes a tool with sample inputs and discovers the output schema.
 * Creates/updates table columns based on the flattened JSON response.
 *
 * POST /api/tools/test-run
 * Body: { toolId: string, tableId: number, inputs?: Record<string, any> }
 *
 * Response: { discoveredColumns: Array<{ name: string, type: string }> }
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/test-auth';
import { getTableApplicationService } from '@/ddd/application/di/container';
import { TableId } from '@/ddd/domain/shared/value-objects';
import { flattenJsonWithTypes } from '@/lib/utils/flatten-json';
import { db } from '@/lib/db/client';
import { tools } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { FieldType } from '@/ddd/domain/tables/value-objects/table-field';

// Map inferred types to table field types
function mapToFieldType(type: 'text' | 'number' | 'boolean' | 'json'): FieldType {
  switch (type) {
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'json':
      return 'json';
    default:
      return 'text';
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication required' },
        { status: 401 }
      );
    }

    const { toolId, tableId, inputs = {} } = await request.json();

    if (!toolId || !tableId) {
      return NextResponse.json(
        { error: 'toolId and tableId are required' },
        { status: 400 }
      );
    }

    // Get the tool definition
    const toolRows = await db.select()
      .from(tools)
      .where(eq(tools.id, toolId))
      .limit(1);

    if (toolRows.length === 0) {
      return NextResponse.json(
        { error: 'Tool not found' },
        { status: 404 }
      );
    }

    const tool = toolRows[0];

    // TODO: Actually execute the tool via the Python backend
    // For now, we return a placeholder message indicating what would happen
    // In the future, this will call the worker to execute the tool
    //
    // The execution flow would be:
    // 1. Get user's OAuth connection for the tool's app
    // 2. Call Python worker with tool ID, inputs, and connection
    // 3. Get JSON response from tool execution
    // 4. Flatten and create columns

    // For now, return a sample response structure based on the tool type
    // This allows testing the UI without actual tool execution
    const sampleResponse = generateSampleResponse(tool.id, tool.displayName);

    if (!sampleResponse) {
      return NextResponse.json(
        {
          error: 'Tool test run not yet implemented. Connect your account and configure inputs first.',
          hint: 'Full tool execution will be available once the Python backend integration is complete.',
        },
        { status: 501 }
      );
    }

    // Flatten the response and infer types
    const flattenedFields = flattenJsonWithTypes(sampleResponse);

    // Get existing fields for the table
    const tableService = getTableApplicationService();
    const existingFields = await tableService.getFieldsForTable(TableId.fromNumber(tableId));
    const existingFieldNames = new Set(existingFields.map(f => f.name));

    // Create new columns for fields that don't exist
    const createdColumns: { name: string; type: string }[] = [];
    const errors: string[] = [];

    for (const field of flattenedFields) {
      // Skip if field already exists
      if (existingFieldNames.has(field.name)) {
        createdColumns.push({ name: field.name, type: field.type });
        continue;
      }

      // Skip reserved field names
      if (field.name === 'id' || field.name === 'created_at' || field.name === 'updated_at') {
        continue;
      }

      try {
        const fieldType = mapToFieldType(field.type);
        const result = await tableService.createField({
          tableId: TableId.fromNumber(tableId),
          name: field.name,
          type: fieldType,
          required: false,
          metadata: {},
        });

        if (result.success) {
          createdColumns.push({ name: field.name, type: field.type });
        } else {
          errors.push(`Failed to create field '${field.name}': ${result.error}`);
        }
      } catch (err) {
        errors.push(`Error creating field '${field.name}': ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      discoveredColumns: createdColumns,
      errors: errors.length > 0 ? errors : undefined,
      sampleData: sampleResponse,
      message: 'Schema discovered from sample response. Full execution requires Python backend integration.',
    });

  } catch (error) {
    console.error('Error in tool test run:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run tool test' },
      { status: 500 }
    );
  }
}

/**
 * Generate a sample response structure based on tool ID/type.
 * This is used for schema discovery before actual tool execution is implemented.
 */
function generateSampleResponse(toolId: string, displayName: string): Record<string, unknown> | null {
  // Gmail tools
  if (toolId.includes('gmail')) {
    if (toolId.includes('send')) {
      return {
        id: 'msg_abc123',
        threadId: 'thread_xyz789',
        labelIds: ['SENT'],
      };
    }
    if (toolId.includes('list') || toolId.includes('search')) {
      return {
        id: 'msg_abc123',
        threadId: 'thread_xyz789',
        snippet: 'Email preview text...',
        subject: 'Email Subject',
        from: 'sender@example.com',
        to: 'recipient@example.com',
        date: '2024-01-15T10:30:00Z',
      };
    }
  }

  // Slack tools
  if (toolId.includes('slack')) {
    if (toolId.includes('send') || toolId.includes('post')) {
      return {
        ok: true,
        channel: 'C1234567890',
        ts: '1234567890.123456',
        message: {
          text: 'Message content',
          ts: '1234567890.123456',
        },
      };
    }
    if (toolId.includes('list')) {
      return {
        id: 'C1234567890',
        name: 'general',
        is_channel: true,
        is_private: false,
      };
    }
  }

  // Google Sheets tools
  if (toolId.includes('sheets') || toolId.includes('spreadsheet')) {
    return {
      spreadsheetId: 'abc123xyz',
      updatedRange: 'Sheet1!A1:D10',
      updatedRows: 10,
      updatedColumns: 4,
      updatedCells: 40,
    };
  }

  // Generic API response fallback
  return {
    id: 'resource_id',
    status: 'success',
    data: 'Response data',
    timestamp: new Date().toISOString(),
  };
}
