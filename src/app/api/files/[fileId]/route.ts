/**
 * Single File Operations API Endpoint
 *
 * RESTful endpoints for file access:
 * - GET: Get file metadata and download URL
 * - PUT: Update file metadata (name)
 * - DELETE: Delete file from row field
 *
 * Files are stored as field values in table rows, not as standalone entities.
 * Context params (tableId, rowId, fieldId) are required to locate the file.
 *
 * AIDEV-NOTE: Created to support Python CRUD tools calling emery-read-file.
 * Uses "pass full context" approach - requires tableId, rowId, fieldId query params.
 */

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute, parseIntParam, parseJsonBody } from '@/lib/api/base';
import { hasResourcePermission } from '@/lib/auth';
import { getFileApplicationService, getTableApplicationService, getRowApplicationService } from '@/ddd/application/di/container';
import { TableId, FieldId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import { RowId, Row } from '@/ddd/domain/tables/value-objects/row';
import type { FileFieldValue } from '@/ddd/domain/tables/value-objects/field-values';

/**
 * GET /api/files/[fileId]
 * Get file metadata and presigned download URL
 *
 * Query params required:
 * - tableId: Table containing the file field
 * - rowId: Row containing the file
 * - fieldId: Field (column) that holds files
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const { fileId } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Parse required context params
    const tableIdParam = searchParams.get('tableId');
    const rowIdParam = searchParams.get('rowId');
    const fieldIdParam = searchParams.get('fieldId');

    if (!tableIdParam || !rowIdParam || !fieldIdParam) {
      return {
        success: false,
        error: 'Missing required query params: tableId, rowId, fieldId',
        status: 400
      };
    }

    const tableIdNum = parseIntParam(tableIdParam, 'tableId');

    if (!user.organizationId || !await hasResourcePermission(user.id, 'table:view', user.organizationId, 'tables', tableIdNum)) {
      return { success: false, error: 'Permission denied', status: 403 };
    }

    const tableId = TableId.fromNumber(tableIdNum);
    const fieldId = FieldId.fromNumber(parseIntParam(fieldIdParam, 'fieldId'));
    const rowId = RowId.fromString(rowIdParam);
    const organizationId = OrganizationId.fromNumber(user.organizationId);

    // Get the row to find the file in its field value
    const rowService = getRowApplicationService();
    const row = await rowService.getRow(tableId, rowId);

    if (!row) {
      return {
        success: false,
        error: `Row ${rowIdParam} not found in table ${tableIdParam}`,
        status: 404
      };
    }

    // Get the field value containing files (use string field ID)
    const fieldValue = row.getFieldValue(fieldIdParam);

    if (!fieldValue || !Array.isArray(fieldValue.value)) {
      return {
        success: false,
        error: `No file field found at field ${fieldIdParam}`,
        status: 404
      };
    }

    // Find the specific file in the array
    const files = fieldValue.value as FileFieldValue[];
    const file = files.find(f => f.id === fileId);

    if (!file) {
      return {
        success: false,
        error: `File ${fileId} not found in field`,
        status: 404
      };
    }

    // Generate download URL using s3Key
    const fileService = getFileApplicationService();
    const urlResult = await fileService.generateDownloadUrl({
      fileId: file.s3Key,  // Use s3Key as the file key
      tableId,
      fieldId,
      organizationId
    });

    if (!urlResult.success) {
      return {
        success: false,
        error: urlResult.error || 'Failed to generate download URL',
        status: 500
      };
    }

    return {
      success: true,
      data: {
        id: file.id,
        name: file.name,
        size: file.size,
        mimeType: file.mimeType,
        uploadedAt: file.uploadedAt,
        downloadUrl: urlResult.data?.url
      }
    };
  });
}

/**
 * DELETE /api/files/[fileId]
 * Delete file from row field
 *
 * Query params required:
 * - tableId: Table containing the file field
 * - rowId: Row containing the file
 * - fieldId: Field (column) that holds files
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const { fileId } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Parse required context params
    const tableIdParam = searchParams.get('tableId');
    const rowIdParam = searchParams.get('rowId');
    const fieldIdParam = searchParams.get('fieldId');

    if (!tableIdParam || !rowIdParam || !fieldIdParam) {
      return {
        success: false,
        error: 'Missing required query params: tableId, rowId, fieldId',
        status: 400
      };
    }

    const tableIdNum = parseIntParam(tableIdParam, 'tableId');

    if (!user.organizationId || !await hasResourcePermission(user.id, 'table:manage', user.organizationId, 'tables', tableIdNum)) {
      return { success: false, error: 'Permission denied', status: 403 };
    }

    const tableId = TableId.fromNumber(tableIdNum);
    const fieldId = FieldId.fromNumber(parseIntParam(fieldIdParam, 'fieldId'));
    const organizationId = OrganizationId.fromNumber(user.organizationId);

    // Delete file using file service
    const fileService = getFileApplicationService();
    const result = await fileService.deleteFile({
      fileId,  // Just pass the fileId string
      tableId,
      fieldId,
      organizationId
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to delete file',
        status: 400
      };
    }

    return {
      success: true,
      data: { id: fileId },
      message: 'File deleted successfully'
    };
  });
}

/**
 * PUT /api/files/[fileId]
 * Update file metadata (currently supports renaming)
 *
 * Query params required:
 * - tableId: Table containing the file field
 * - rowId: Row containing the file
 * - fieldId: Field (column) that holds files
 *
 * Request body:
 * {
 *   name?: string  // New filename
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const { fileId } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Parse required context params
    const tableIdParam = searchParams.get('tableId');
    const rowIdParam = searchParams.get('rowId');
    const fieldIdParam = searchParams.get('fieldId');

    if (!tableIdParam || !rowIdParam || !fieldIdParam) {
      return {
        success: false,
        error: 'Missing required query params: tableId, rowId, fieldId',
        status: 400
      };
    }

    const tableIdNum = parseIntParam(tableIdParam, 'tableId');

    if (!user.organizationId || !await hasResourcePermission(user.id, 'table:manage', user.organizationId, 'tables', tableIdNum)) {
      return { success: false, error: 'Permission denied', status: 403 };
    }

    const body = await parseJsonBody(request);
    if (!body) {
      return {
        success: false,
        error: 'Invalid request body',
        status: 400
      };
    }
    const tableId = TableId.fromNumber(tableIdNum);
    const rowId = RowId.fromString(rowIdParam);

    // Get the table to access its fields
    const tableService = getTableApplicationService();
    const rowService = getRowApplicationService();
    const table = await tableService.getTable(tableId);

    if (!table) {
      return {
        success: false,
        error: `Table ${tableIdParam} not found`,
        status: 404
      };
    }

    // Get the row to find and update the file
    const row = await rowService.getRow(tableId, rowId);

    if (!row) {
      return {
        success: false,
        error: `Row ${rowIdParam} not found in table ${tableIdParam}`,
        status: 404
      };
    }

    // Get the field value containing files
    const fieldValue = row.getFieldValue(fieldIdParam);

    if (!fieldValue || !Array.isArray(fieldValue.value)) {
      return {
        success: false,
        error: `No file field found at field ${fieldIdParam}`,
        status: 404
      };
    }

    // Find and update the specific file in the array
    const files = fieldValue.value as FileFieldValue[];
    const fileIndex = files.findIndex(f => f.id === fileId);

    if (fileIndex === -1) {
      return {
        success: false,
        error: `File ${fileId} not found in field`,
        status: 404
      };
    }

    // Update file metadata
    const updatedFile = { ...files[fileIndex] };
    if (body.name) {
      updatedFile.name = body.name;
    }

    // Create updated files array
    const updatedFiles = [...files];
    updatedFiles[fileIndex] = updatedFile;

    // Get existing row data and merge with update
    const existingData = row.toPlainObject(table.fields);
    const mergedData = {
      ...existingData,
      [fieldIdParam]: updatedFiles
    };

    // Create Row entity from merged data
    const updatedRow = Row.fromPlainObject(mergedData, tableIdNum, table.fields);

    // Update the row with the modified files array
    const updateResult = await rowService.updateRow({
      tableId,
      rowId,
      data: updatedRow,
      updatedBy: UserId.fromString(user.id)
    });

    if (!updateResult.success) {
      return {
        success: false,
        error: updateResult.error || 'Failed to update file',
        status: 400
      };
    }

    return {
      success: true,
      data: {
        id: updatedFile.id,
        name: updatedFile.name,
        size: updatedFile.size,
        mimeType: updatedFile.mimeType,
        uploadedAt: updatedFile.uploadedAt
      },
      message: 'File updated successfully'
    };
  });
}
