export const dynamic = 'force-dynamic';

/**
 * Single Document Operations API Endpoint
 *
 * RESTful endpoints for individual document operations:
 * - GET: Get document metadata and TipTap content
 * - PUT: Update document TipTap content
 * - DELETE: Delete document
 *
 * AIDEV-NOTE: Documents are field values in table rows, so we need
 * tableId, rowId, fieldId context to locate them.
 */

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute } from '@/lib/api/base';
import { getDocumentApplicationService } from '@/ddd/application/di/container';
import { OrganizationId, TableId, FieldId, UserId } from '@/ddd/domain/shared/value-objects';

/**
 * GET /api/documents/[id]
 * Get document metadata and TipTap content
 *
 * Query params (required):
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
    const { searchParams } = new URL(request.url);

    const tableIdParam = searchParams.get('tableId');
    const rowIdParam = searchParams.get('rowId');
    const fieldIdParam = searchParams.get('fieldId');

    // Validate required params
    if (!tableIdParam || !fieldIdParam) {
      return {
        success: false,
        error: 'Missing required parameters: tableId, fieldId',
        status: 400
      };
    }

    const tableId = parseInt(tableIdParam, 10);
    const fieldId = parseInt(fieldIdParam, 10);

    if (isNaN(tableId) || isNaN(fieldId)) {
      return {
        success: false,
        error: 'Invalid tableId or fieldId - must be numbers',
        status: 400
      };
    }

    const organizationId = user.organizationId;
    if (!organizationId) {
      return {
        success: false,
        error: 'No organization context',
        status: 400
      };
    }

    const documentService = getDocumentApplicationService();

    try {
      // Get TipTap content from S3
      const contentResult = await documentService.getTiptapContent({
        documentId: id,
        organizationId: OrganizationId.fromNumber(organizationId),
        tableId: TableId.fromNumber(tableId),
        fieldId: FieldId.fromNumber(fieldId),
        requestedBy: UserId.fromString(user.id)
      });

      if (!contentResult.success) {
        return {
          success: false,
          error: contentResult.error || 'Failed to get document content',
          status: 404
        };
      }

      // Also get the document field value for metadata
      const fieldValueResult = await documentService.getDocumentFieldValue(
        id,
        OrganizationId.fromNumber(organizationId),
        TableId.fromNumber(tableId),
        FieldId.fromNumber(fieldId)
      );

      return {
        success: true,
        data: {
          id,
          tableId,
          fieldId,
          name: fieldValueResult.data?.name || 'Unknown',
          title: contentResult.data?.metadata?.title || fieldValueResult.data?.documentMetadata?.title || 'Untitled',
          tiptapContent: contentResult.data?.content,
          metadata: {
            ...contentResult.data?.metadata,
            ...fieldValueResult.data?.documentMetadata,
            size: fieldValueResult.data?.size,
            mimeType: fieldValueResult.data?.mimeType,
            uploadedAt: fieldValueResult.data?.uploadedAt
          }
        }
      };

    } catch (error) {
      console.error('[DOCUMENTS-API] Error getting document:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get document',
        status: 500
      };
    }
  });
}

/**
 * PUT /api/documents/[id]
 * Update document TipTap content
 *
 * Query params (required):
 * - tableId: Table containing the document
 * - fieldId: Field containing the document
 *
 * Body:
 * - tiptapContent: The updated TipTap JSON content
 * - title?: Optional new title
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const tableIdParam = searchParams.get('tableId');
    const fieldIdParam = searchParams.get('fieldId');

    // Validate required params
    if (!tableIdParam || !fieldIdParam) {
      return {
        success: false,
        error: 'Missing required parameters: tableId, fieldId',
        status: 400
      };
    }

    const tableId = parseInt(tableIdParam, 10);
    const fieldId = parseInt(fieldIdParam, 10);

    if (isNaN(tableId) || isNaN(fieldId)) {
      return {
        success: false,
        error: 'Invalid tableId or fieldId - must be numbers',
        status: 400
      };
    }

    const organizationId = user.organizationId;
    if (!organizationId) {
      return {
        success: false,
        error: 'No organization context',
        status: 400
      };
    }

    // Parse request body
    let body: { tiptapContent?: object; title?: string };
    try {
      body = await request.json();
    } catch (error) {
      return {
        success: false,
        error: 'Invalid JSON body',
        status: 400
      };
    }

    if (!body.tiptapContent) {
      return {
        success: false,
        error: 'Missing tiptapContent in request body',
        status: 400
      };
    }

    const documentService = getDocumentApplicationService();

    try {
      // Update the document content
      const updateResult = await documentService.updateTiptapDocument({
        documentId: id,
        organizationId: OrganizationId.fromNumber(organizationId),
        tableId: TableId.fromNumber(tableId),
        fieldId: FieldId.fromNumber(fieldId),
        content: body.tiptapContent,
        updatedBy: UserId.fromString(user.id)
      });

      if (!updateResult.success) {
        return {
          success: false,
          error: updateResult.error || 'Failed to update document',
          status: 400
        };
      }

      return {
        success: true,
        data: {
          id,
          message: 'Document updated successfully',
          version: updateResult.data?.documentMetadata?.version || 1
        }
      };

    } catch (error) {
      console.error('[DOCUMENTS-API] Error updating document:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update document',
        status: 500
      };
    }
  });
}

/**
 * DELETE /api/documents/[id]
 * Delete document (STUB - to be implemented)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    // TODO: Implement document deletion
    // Would need to remove from S3 and update the field value array
    return {
      success: false,
      error: 'Document deletion via API not yet implemented',
      status: 501
    };
  });
}
