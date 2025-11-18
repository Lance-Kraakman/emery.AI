/**
 * Row Operations API Endpoint
 *
 * RESTful endpoints for table row management:
 * - POST: Create a new row in a table
 * - GET: Get rows with pagination and filtering
 * - PUT: Update an existing row
 * - DELETE: Delete a row
 *
 * Uses standardized base utilities for consistent auth and error handling
 * Delegates to server actions to avoid duplicating business logic
 */

import { NextRequest } from "next/server";
import { withAuthenticatedRoute, parseJsonBody, requireParam, parseIntParam, parseOptionalIntParam } from '@/lib/api/base';
import { createRow, updateRowData, deleteRowData, getRowsDSG } from '@/app/actions/rows';

/**
 * POST /api/rows
 * Create a new row in a table
 *
 * Request body:
 * {
 *   tableId: number (required),
 *   data: Record<string, any> (required) - Field values for the row
 * }
 */
export async function POST(request: NextRequest): Promise<Response> {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  // Extract tracking headers
  const callId = request.headers.get('x-call-id');
  const source = request.headers.get('x-source');
  const threadId = request.headers.get('x-thread-id');
  
  console.log(`[API_POST] START - request_id: ${requestId}, call_id: ${callId}, source: ${source}, thread_id: ${threadId}`);
  console.log(`[API_POST] Headers:`, {
    'x-call-id': callId,
    'x-source': source,
    'x-thread-id': threadId,
    'authorization': request.headers.get('authorization') ? '[REDACTED]' : 'none',
    'x-organization-id': request.headers.get('x-organization-id'),
    'content-type': request.headers.get('content-type')
  });
  
  return withAuthenticatedRoute(request, async (user) => {
    const authTime = Date.now();
    console.log(`[API_POST] Authenticated - request_id: ${requestId}, user: ${user.id}, auth_time: ${authTime - startTime}ms`);
    
    const body = await parseJsonBody(request);
    const parseTime = Date.now();
    console.log(`[API_POST] Body parsed - request_id: ${requestId}, parse_time: ${parseTime - authTime}ms`);

    if (!body) {
      console.log(`[API_POST] Invalid body - request_id: ${requestId}`);
      return {
        success: false,
        error: 'Invalid request body',
        status: 400
      };
    }

    const { tableId, data } = body;
    
    // Check if this is from Python tool
    const isFromPythonTool = source === 'python_tool' || callId?.startsWith('http_');
    console.log(`[API_POST] Request source analysis - request_id: ${requestId}, is_from_python_tool: ${isFromPythonTool}, call_id: ${callId}`);

    // Validate required fields
    requireParam(tableId, 'tableId');
    requireParam(data, 'data');
    
    console.log(`[API_POST] Validated params - request_id: ${requestId}, table_id: ${tableId}, data_keys: ${Object.keys(data || {})}`);

    // Use server action function to avoid duplication
    console.log(`[API_POST] Calling createRow server action - request_id: ${requestId}`);
    const actionStart = Date.now();
    
    const result = await createRow({ tableId, data });
    
    const actionTime = Date.now() - actionStart;
    console.log(`[API_POST] Server action completed - request_id: ${requestId}, success: ${result.success}, action_time: ${actionTime}ms`);

    if (!result.success) {
      const totalTime = Date.now() - startTime;
      console.log(`[API_POST] Server action failed - request_id: ${requestId}, error: ${result.error}, total_time: ${totalTime}ms`);
      return {
        success: false,
        error: result.error || 'Failed to create row',
        status: 400
      };
    }

    const totalTime = Date.now() - startTime;
    console.log(`[API_POST] ✅ SUCCESS - request_id: ${requestId}, total_time: ${totalTime}ms, is_from_python_tool: ${isFromPythonTool}`);
    
    return {
      success: true,
      data: result.data,
      message: 'Row created successfully'
    };
  });
}

/**
 * GET /api/rows
 * Get rows with pagination and filtering
 *
 * Query parameters:
 * - tableId: number (required)
 * - limit: number (optional, default: 100)
 * - offset: number (optional, default: 0)
 * - orderBy: string (optional)
 * - orderDirection: 'ASC' | 'DESC' (optional)
 */
export async function GET(request: NextRequest): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const { searchParams } = new URL(request.url);
    const tableIdStr = searchParams.get("tableId");

    if (!tableIdStr) {
      return {
        success: false,
        error: 'tableId is required',
        status: 400
      };
    }

    const tableId = parseIntParam(tableIdStr, 'tableId');
    const limit = parseOptionalIntParam(searchParams.get("limit"), 100);
    const offset = parseOptionalIntParam(searchParams.get("offset"), 0);
    const orderBy = searchParams.get("orderBy") || undefined;
    const orderDirection = (searchParams.get("orderDirection") as 'ASC' | 'DESC') || undefined;

    // Use server action function with pagination
    const result = await getRowsDSG(tableId, limit, offset, orderBy, orderDirection);

    return {
      success: true,
      data: {
        rows: result.rows,
        hasMore: result.hasMore,
        total: result.total,
        limit,
        offset
      }
    };
  });
}

/**
 * PUT /api/rows
 * Update an existing row
 *
 * Request body:
 * {
 *   tableId: number (required),
 *   rowId: string (required),
 *   data: Record<string, any> (required) - Updated field values
 * }
 */
export async function PUT(request: NextRequest): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const body = await parseJsonBody(request);

    if (!body) {
      return {
        success: false,
        error: 'Invalid request body',
        status: 400
      };
    }

    const { tableId, rowId, data } = body;

    // Validate required fields
    requireParam(tableId, 'tableId');
    requireParam(rowId, 'rowId');
    requireParam(data, 'data');

    // Use server action function
    const result = await updateRowData({ tableId, rowId, data });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to update row',
        status: 400
      };
    }

    return {
      success: true,
      data: result.data,
      message: 'Row updated successfully'
    };
  });
}

/**
 * DELETE /api/rows
 * Delete a row
 *
 * Query parameters:
 * - tableId: number (required)
 * - rowId: string (required)
 */
export async function DELETE(request: NextRequest): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const { searchParams } = new URL(request.url);
    const tableIdStr = searchParams.get("tableId");
    const rowId = searchParams.get("rowId");

    if (!tableIdStr || !rowId) {
      return {
        success: false,
        error: 'tableId and rowId are required',
        status: 400
      };
    }

    const tableId = parseIntParam(tableIdStr, 'tableId');

    // Use server action function
    const result = await deleteRowData(tableId, rowId);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to delete row',
        status: 400
      };
    }

    return {
      success: true,
      data: { id: rowId },
      message: 'Row deleted successfully'
    };
  });
}