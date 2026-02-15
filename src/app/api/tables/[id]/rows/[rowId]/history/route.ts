/**
 * Row History API
 *
 * Provides read access to modification history for a specific row.
 * Used by the record_history tool in the agent system.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthenticatedRoute } from '@/lib/api/base';
import { getAuditApplicationService } from '@/ddd/application/di/getters';

interface RouteParams {
  params: Promise<{
    id: string;
    rowId: string;
  }>;
}

/**
 * GET /api/tables/[id]/rows/[rowId]/history
 *
 * Get modification history for a row.
 *
 * Query parameters:
 * - limit: Maximum number of entries to return (default: 10, max: 50)
 *
 * Returns:
 * - history: Array of modification entries with:
 *   - operation: 'INSERT', 'UPDATE', or 'DELETE'
 *   - changed_by: User or agent name who made the change
 *   - changed_by_type: 'user', 'agent', 'webhook', or 'public_app'
 *   - changed_at: ISO timestamp
 *   - version: Change version number
 *   - field_changes: Object with old/new values for changed fields
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  return withAuthenticatedRoute(request, async () => {
    const { id, rowId } = await params;
    const { searchParams } = new URL(request.url);

    // Parse limit from query params
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 50) : 10;

    // Get row history using existing audit service
    const auditService = getAuditApplicationService();
    const history = await auditService.getRowHistory(
      parseInt(id, 10),
      rowId,
      limit
    );

    return {
      success: true,
      data: {
        history: history.map((h) => ({
          operation: h.operation.toLowerCase(),
          changed_by: h.changedByName || h.changedByType,
          changed_by_type: h.changedByType,
          changed_at: h.changedAt.toISOString(),
          version: h.version,
          field_changes: h.fieldChanges,
        })),
        table_id: id,
        row_id: rowId,
      },
    };
  }) as Promise<NextResponse>;
}
