/**
 * Document List/Create API Endpoint
 *
 * RESTful endpoints for document operations:
 * - GET: List all documents across all tables in the organization
 * - POST: Create new document (future implementation)
 *
 * AIDEV-NOTE: Documents are stored as field values in table rows, not standalone entities.
 * This endpoint scans all tables with document-type fields to find documents.
 */

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute } from '@/lib/api/base';
import { logAgentMutation } from '@/lib/api/agent-context';
import { getTableApplicationService, getRowApplicationService, getDocumentApplicationService } from '@/ddd/application/di/container';
import { OrganizationId, TableId, FieldId, UserId } from '@/ddd/domain/shared/value-objects';
import { DocumentFieldValue } from '@/ddd/domain/tables/value-objects/field-values';

/**
 * GET /api/documents
 * List all documents across all tables in the organization
 *
 * Returns documents with their location info (tableId, rowId, fieldId)
 * so they can be retrieved/updated via the document CRUD operations.
 */
export async function GET(request: NextRequest): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const organizationId = user.organizationId;

    if (!organizationId) {
      return {
        success: false,
        error: 'No organization context',
        status: 400
      };
    }

    const tableService = getTableApplicationService();
    const rowService = getRowApplicationService();
    const documentService = getDocumentApplicationService();

    try {
      // 1. Get all tables in the organization
      const tables = await tableService.getTablesForOrganization(
        OrganizationId.fromNumber(organizationId)
      );

      const documents: Array<{
        id: string;
        name: string;
        title: string;
        tableId: number;
        tableName: string;
        rowId: string;
        fieldId: number;
        fieldName: string;
        mimeType: string;
        version: number;
        lastEditedAt: string | null;
        lastEditedBy: string | null;
      }> = [];

      // 2. For each table, find document fields and scan for documents
      for (const table of tables) {
        // Find document-type fields (type 'document' or 'file' with tiptap mime)
        const documentFields = table.fields.filter(
          field => field.type === 'document' || field.type === 'file'
        );

        if (documentFields.length === 0) continue;

        // 3. Get all rows for this table
        const rows = await rowService.getRows(table.id, { limit: 1000, offset: 0 });

        if (!rows || rows.length === 0) continue;

        // 4. Extract documents from each row's document fields
        for (const row of rows) {
          for (const field of documentFields) {
            try {
              const fieldValue = row.getFieldValue(field.id.value.toString());
              if (!fieldValue || !fieldValue.value) continue;

              // Document fields are arrays of DocumentFieldValue
              const files = fieldValue.value as DocumentFieldValue[];
              if (!Array.isArray(files)) continue;

              for (const file of files) {
                // Check if it's a TipTap document (by mimeType)
                if (file.mimeType === 'application/vnd.tiptap+json') {
                  documents.push({
                    id: file.id,
                    name: file.name,
                    title: file.documentMetadata?.title || file.name.replace(/\.tiptap\.json$/, ''),
                    tableId: table.id.value,
                    tableName: table.name,
                    rowId: row.id.value,
                    fieldId: field.id.value,
                    fieldName: field.name,
                    mimeType: file.mimeType,
                    version: file.documentMetadata?.version || 1,
                    lastEditedAt: file.documentMetadata?.lastEditedAt || null,
                    lastEditedBy: file.documentMetadata?.lastEditedBy || null
                  });
                }
              }
            } catch (error) {
              // Skip malformed field values
              console.warn(`[DOCUMENTS-API] Error parsing field value:`, error);
              continue;
            }
          }
        }
      }

      return {
        success: true,
        data: documents
      };

    } catch (error) {
      console.error('[DOCUMENTS-API] Error listing documents:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list documents',
        status: 500
      };
    }
  });
}

/**
 * POST /api/documents
 * Create a new TipTap document
 *
 * Body:
 * - tableId: number (required) - Table containing the document field
 * - fieldId: number (required) - Field (column) to store the document
 * - title: string (required) - Document title
 * - rowId?: string (optional) - Row to add document to; if not provided, creates new row
 * - initialContent?: object[] (optional) - Initial TipTap content nodes
 */
export async function POST(request: NextRequest): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const organizationId = user.organizationId;

    if (!organizationId) {
      return {
        success: false,
        error: 'No organization context',
        status: 400
      };
    }

    // Parse request body
    let body: {
      tableId?: number;
      fieldId?: number;
      title?: string;
      rowId?: string;
      initialContent?: object[];
    };
    try {
      body = await request.json();
    } catch (error) {
      return {
        success: false,
        error: 'Invalid JSON body',
        status: 400
      };
    }

    // Validate required fields
    if (!body.tableId || !body.fieldId) {
      return {
        success: false,
        error: 'Missing required fields: tableId, fieldId',
        status: 400
      };
    }

    if (!body.title) {
      return {
        success: false,
        error: 'Missing required field: title',
        status: 400
      };
    }

    const documentService = getDocumentApplicationService();

    try {
      const result = await documentService.createTiptapDocument({
        organizationId: OrganizationId.fromNumber(organizationId),
        tableId: TableId.fromNumber(body.tableId),
        fieldId: FieldId.fromNumber(body.fieldId),
        title: body.title,
        rowId: body.rowId,
        initialContent: body.initialContent,
        createdBy: UserId.fromString(user.id)
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Failed to create document',
          status: 400
        };
      }

      logAgentMutation(request, user, {
        action: 'create',
        resourceType: 'document',
        resourceId: result.data?.id,
        resourceName: body.title,
      });

      return {
        success: true,
        data: result.data,
        status: 201
      };

    } catch (error) {
      console.error('[DOCUMENTS-API] Error creating document:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create document',
        status: 500
      };
    }
  });
}
