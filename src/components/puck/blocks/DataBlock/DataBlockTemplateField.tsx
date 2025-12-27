'use client';

/**
 * DataBlockTemplateField - Custom field for editing DataBlock templates
 *
 * Shows a summary of the template content and an "Edit Template" button.
 * When clicked, uses EditingStackContext to push the DataBlock onto
 * the editing stack (like dialogs).
 *
 * Only viewId and tableId are passed to the editing stack - TemplateEditorContext
 * fetches fields and sample row fresh to avoid stale data issues.
 *
 * NOTE: This component does NOT use usePuck() - it must be safe to import
 * in public/preview routes where there's no <Puck> wrapper. The componentId
 * is passed from resolveFields where data.props.id is available.
 */

import { Button } from '@/components/ui/button';
import { Pencil, Layers } from 'lucide-react';
import type { Data } from '@measured/puck';
import { useEditingStack } from '../../contexts/EditingStackContext';

interface DataBlockTemplateFieldProps {
  value: Data | undefined;
  onChange: (value: Data) => void;
  /** Component ID - passed from data.props.id in resolveFields */
  componentId: string;
  name: string;
  /** View ID from the DataBlock - required for template editing */
  viewId?: number;
  /** Table ID from the DataBlock - required for template editing */
  tableId?: number;
}

/**
 * DataBlockTemplateField - Custom field renderer for template content
 */
export function DataBlockTemplateField({
  value,
  componentId,
  name,
  viewId,
  tableId,
}: DataBlockTemplateFieldProps) {
  const { pushDataBlock } = useEditingStack();

  const handleEditTemplate = () => {
    // Validate required IDs before pushing
    if (!viewId || !tableId) {
      console.warn('[DataBlockTemplateField] Cannot edit template: viewId or tableId missing');
      return;
    }

    if (!componentId) {
      console.warn('[DataBlockTemplateField] Cannot edit template: component ID not found');
      return;
    }

    const templateContent = value || { content: [], root: { props: {} }, zones: {} };
    // pushDataBlock is wrapped by PuckEditorLayout to inject appState.data
    pushDataBlock(componentId, name, templateContent, viewId, tableId);
  };

  const componentCount = value?.content?.length || 0;

  return (
    <div className="space-y-2">
      {/* Template summary */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Layers className="h-4 w-4" />
        <span>
          {componentCount === 0
            ? 'No template content'
            : `${componentCount} component${componentCount !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Edit button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleEditTemplate}
        className="w-full"
      >
        <Pencil className="h-4 w-4 mr-2" />
        Edit Row Template
      </Button>
    </div>
  );
}

export default DataBlockTemplateField;
