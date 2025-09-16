'use client';

import React, { useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Edit, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BaseModal } from '@/app/(app)/agents/components/modals/BaseModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TextFieldDisplay,
  NumberFieldDisplay,
  BooleanFieldDisplay,
  DateFieldDisplay,
  FileFieldDisplay,
  DocumentFieldDisplay,
  RelationFieldDisplay
} from './field-displays';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { RowDTO, TypedFieldValueDTO } from '@/app/mappers/row-mapper';
import type {
  DateFieldValue,
  FileArrayFieldValue,
  DocumentArrayFieldValue,
  RelationArrayFieldValue
} from '@/ddd/domain/tables/value-objects/field-values';

interface RowViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fields: FieldDTO[];
  rows: RowDTO[];
  currentRowIndex: number;
  onNavigate: (newIndex: number) => void;
  onEdit?: (rowIndex: number) => void;
}

export function RowViewerModal({
  isOpen,
  onClose,
  fields,
  rows,
  currentRowIndex,
  onNavigate,
  onEdit
}: RowViewerModalProps) {
  const currentRow = rows[currentRowIndex];
  const canNavigatePrev = currentRowIndex > 0;
  const canNavigateNext = currentRowIndex < rows.length - 1;

  // Keyboard navigation
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isOpen) return;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        if (canNavigatePrev) {
          onNavigate(currentRowIndex - 1);
        }
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (canNavigateNext) {
          onNavigate(currentRowIndex + 1);
        }
        break;
      case 'e':
      case 'E':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          onEdit?.(currentRowIndex);
        }
        break;
    }
  }, [isOpen, currentRowIndex, canNavigatePrev, canNavigateNext, onNavigate, onEdit]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!currentRow) {
    return null;
  }

  // Create a map of field values by field ID for easy lookup
  const fieldValueMap = new Map<number, TypedFieldValueDTO>();
  currentRow.fieldValues.forEach(fv => {
    const field = fields.find(f => f.name === fv.fieldSlug || f.id.toString() === fv.fieldSlug);
    if (field) {
      fieldValueMap.set(field.id, fv);
    }
  });

  // Sort fields by order index
  const sortedFields = [...fields].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

  const renderFieldValue = (field: FieldDTO, fieldValue?: TypedFieldValueDTO) => {
    const value = fieldValue?.value;

    switch (field.type) {
      case 'text':
        return <TextFieldDisplay value={value as string} fieldName={field.name} />;
      case 'number':
        return <NumberFieldDisplay value={value as number} fieldName={field.name} />;
      case 'boolean':
        return <BooleanFieldDisplay value={value as boolean} fieldName={field.name} />;
      case 'date':
        return <DateFieldDisplay value={value as DateFieldValue} fieldName={field.name} />;
      case 'file':
        return <FileFieldDisplay value={value as FileArrayFieldValue} fieldName={field.name} />;
      case 'document':
        return <DocumentFieldDisplay value={value as DocumentArrayFieldValue} fieldName={field.name} />;
      case 'relation':
        return <RelationFieldDisplay value={value as RelationArrayFieldValue} fieldName={field.name} />;
      default:
        return (
          <div className="text-muted-foreground italic">
            Unsupported field type: {field.type}
          </div>
        );
    }
  };

  const footer = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => onNavigate(currentRowIndex - 1)}
          disabled={!canNavigatePrev}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>

        <Badge variant="outline" className="px-3 py-1">
          {currentRowIndex + 1} of {rows.length}
        </Badge>

        <Button
          variant="outline"
          onClick={() => onNavigate(currentRowIndex + 1)}
          disabled={!canNavigateNext}
          className="flex items-center gap-2"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {onEdit && (
          <Button
            variant="secondary"
            onClick={() => onEdit(currentRowIndex)}
            className="flex items-center gap-2"
          >
            <Edit className="h-4 w-4" />
            Edit Row
          </Button>
        )}
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Row Details"
      description={`Viewing row ${currentRowIndex + 1} of ${rows.length}`}
      size="lg"
      footer={footer}
    >
      <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
        {sortedFields.map((field) => {
          const fieldValue = fieldValueMap.get(field.id);

          return (
            <Card key={field.id} className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    {field.name}
                    {field.required && (
                      <Badge variant="destructive" className="text-xs">
                        Required
                      </Badge>
                    )}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {field.type}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {renderFieldValue(field, fieldValue)}
              </CardContent>
            </Card>
          );
        })}

        {sortedFields.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No fields defined for this table
          </div>
        )}

        <div className="text-xs text-muted-foreground text-center pt-4 border-t">
          Use arrow keys to navigate • Ctrl+E to edit
        </div>
      </div>
    </BaseModal>
  );
}