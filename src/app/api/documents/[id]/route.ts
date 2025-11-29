export const dynamic = 'force-dynamic';

/**
 * Single Document Operations API Endpoint (STUB)
 *
 * RESTful endpoints for document access:
 * - GET: Get document metadata and content
 *
 * TODO: Documents need TipTap structure generation - implement later
 * For now, returns stub response indicating this is not yet implemented.
 *
 * AIDEV-NOTE: Stubbed for Python CRUD tools calling emery-read-document.
 * Full implementation requires TipTap content generation/parsing.
 */

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute, parseIntParam } from '@/lib/api/base';

/**
 * GET /api/documents/[id]
 * Get document metadata and content (STUB)
 *
 * Query params (same as files):
 * - tableId: Table containing the document field
 * - rowId: Row containing the document
 * - fieldId: Field (column) that holds documents
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const { id } = await params;

    // TODO: Implement document retrieval with TipTap content
    // Documents extend FileFieldValue with documentMetadata including TipTap content
    // This requires:
    // 1. Fetching the document from row field value (like files)
    // 2. Generating/parsing TipTap content structure
    // 3. Returning both metadata and content

    return {
      success: false,
      error: 'Document API not yet implemented - requires TipTap structure generation',
      status: 501 // Not Implemented
    };
  });
}

/**
 * PUT /api/documents/[id]
 * Update document content (STUB)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    return {
      success: false,
      error: 'Document API not yet implemented - requires TipTap structure generation',
      status: 501
    };
  });
}

/**
 * DELETE /api/documents/[id]
 * Delete document (STUB)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    return {
      success: false,
      error: 'Document API not yet implemented - requires TipTap structure generation',
      status: 501
    };
  });
}
