export const dynamic = 'force-dynamic';

/**
 * File Content Update API Endpoint
 *
 * PUT: Update file content (for code/markdown editors)
 *
 * Used by CodeViewer and MarkdownViewer to save edited file content
 * back to S3 and update the row reference.
 *
 * AIDEV-NOTE: Endpoint for saving edited file content from chat artifact viewers.
 * Updates S3 file and row field value in a single operation.
 */

import { NextRequest } from 'next/server';
import { withAuthenticatedRoute, parseIntParam, parseJsonBody } from '@/lib/api/base';
import { getFileApplicationService, getTableApplicationService } from '@/ddd/application/di/container';
import { TableId, FieldId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import { RowId, Row } from '@/ddd/domain/tables/value-objects/row';
import type { FileFieldValue } from '@/ddd/domain/tables/value-objects/field-values';

interface UpdateContentBody {
  content: string;
  tableId: number;
  fieldId: number;
  rowId: string;
}

/**
 * PUT /api/files/[fileId]/content
 * Update file content (text-based files like code, markdown)
 *
 * Request body:
 * {
 *   content: string,    // New file content
 *   tableId: number,    // Table containing the file
 *   fieldId: number,    // Field ID containing the file
 *   rowId: string       // Row ID containing the file
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
): Promise<Response> {
  return withAuthenticatedRoute(request, async (user) => {
    const { fileId } = await params;

    if (!user.organizationId) {
      return {
        success: false,
        error: 'Organization ID required',
        status: 400
      };
    }

    const body = await parseJsonBody(request) as UpdateContentBody | null;
    if (!body || !body.content || !body.tableId || !body.fieldId || !body.rowId) {
      return {
        success: false,
        error: 'Missing required fields: content, tableId, fieldId, rowId',
        status: 400
      };
    }

    const { content, tableId: tableIdNum, fieldId: fieldIdNum, rowId: rowIdStr } = body;
    const tableId = TableId.fromNumber(tableIdNum);
    const fieldId = FieldId.fromNumber(fieldIdNum);
    const rowId = RowId.fromString(rowIdStr);
    const organizationId = OrganizationId.fromNumber(user.organizationId);

    // Get the table to validate and access fields
    const tableService = getTableApplicationService();
    const table = await tableService.getTable(tableId);

    if (!table) {
      return {
        success: false,
        error: `Table ${tableIdNum} not found`,
        status: 404
      };
    }

    // Get the row containing the file
    const row = await tableService.getRow(tableId, rowId);

    if (!row) {
      return {
        success: false,
        error: `Row ${rowIdStr} not found in table ${tableIdNum}`,
        status: 404
      };
    }

    // Get the field value containing files (use string field ID)
    const fieldIdStr = fieldIdNum.toString();
    const fieldValue = row.getFieldValue(fieldIdStr);

    if (!fieldValue || !Array.isArray(fieldValue.value)) {
      return {
        success: false,
        error: `No file field found at field ${fieldIdStr}`,
        status: 404
      };
    }

    // Find the specific file in the array
    const files = fieldValue.value as FileFieldValue[];
    const fileIndex = files.findIndex(f => f.id === fileId);

    if (fileIndex === -1) {
      return {
        success: false,
        error: `File ${fileId} not found in field`,
        status: 404
      };
    }

    const existingFile = files[fileIndex];

    // Convert string content to Buffer
    const contentBuffer = Buffer.from(content, 'utf-8');

    // Update file in S3 via FileApplicationService
    const fileService = getFileApplicationService();
    const updateResult = await fileService.updateFile({
      fileId: existingFile.s3Key,  // FileKey is just a string type alias
      fieldId,
      tableId,
      organizationId,
      file: {
        buffer: contentBuffer,
        filename: existingFile.name,
        mimeType: existingFile.mimeType
      }
    });

    if (!updateResult.success || !updateResult.data) {
      return {
        success: false,
        error: updateResult.error || 'Failed to update file content',
        status: 500
      };
    }

    // Update the file entry in the row's field array
    const updatedFile: FileFieldValue = updateResult.data;
    const updatedFiles = [...files];
    updatedFiles[fileIndex] = updatedFile;

    // Get existing row data and merge with update
    const existingData = row.toPlainObject(table.fields);
    const mergedData = {
      ...existingData,
      [fieldIdStr]: updatedFiles
    };

    // Create Row entity from merged data
    const updatedRow = Row.fromPlainObject(mergedData, tableIdNum, table.fields);

    // Update the row with the modified files array
    const rowUpdateResult = await tableService.updateRow({
      tableId,
      rowId,
      data: updatedRow,
      updatedBy: UserId.fromString(user.id)
    });

    if (!rowUpdateResult.success) {
      return {
        success: false,
        error: rowUpdateResult.error || 'Failed to update row with new file',
        status: 500
      };
    }

    return {
      success: true,
      data: updatedFile,
      message: 'File content updated successfully'
    };
  });
}
