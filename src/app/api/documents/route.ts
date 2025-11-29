export const dynamic = 'force-dynamic';

/**
 * Document List/Create API Endpoint (STUB)
 *
 * RESTful endpoints for document operations:
 * - GET: List documents for organization
 * - POST: Create new document
 *
 * TODO: Documents need TipTap structure generation - implement later
 * For now, returns stub response indicating this is not yet implemented.
 *
 * AIDEV-NOTE: Stubbed for Python CRUD tools calling emery-create-document etc.
 * Full implementation requires TipTap content generation/parsing.
 */

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute } from '@/lib/api/base';

/**
 * GET /api/documents
 * List documents for the authenticated user's organization (STUB)
 */
export async function GET(request: NextRequest): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    // TODO: Implement document listing
    // Would need to scan all rows with document fields or maintain a document index
    return {
      success: false,
      error: 'Document list API not yet implemented - requires document indexing',
      status: 501 // Not Implemented
    };
  });
}

/**
 * POST /api/documents
 * Create a new document (STUB)
 *
 * Request body would include:
 * {
 *   name: string,
 *   content?: TipTapContent,
 *   tableId?: number,
 *   rowId?: string,
 *   fieldId?: number
 * }
 */
export async function POST(request: NextRequest): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    // TODO: Implement document creation with TipTap content
    // This requires:
    // 1. Creating/initializing TipTap content structure
    // 2. Storing document in appropriate row field
    // 3. Generating proper document metadata
    return {
      success: false,
      error: 'Document API not yet implemented - requires TipTap structure generation',
      status: 501 // Not Implemented
    };
  });
}
