'use client';

/**
 * FormBlock - Client Component
 *
 * AIDEV-NOTE: Renders a form view using the MultiPageForm component.
 * Receives pre-resolved form configuration data from Puck's resolveData.
 */

import { MultiPageForm, type FormViewConfig, type TableField } from '@/components/forms/MultiPageForm';
import { submitFormView } from '@/app/actions/views';
import { useCallback } from 'react';

export interface FormBlockProps {
  viewId: number;

  // Server-resolved data (populated by resolveData)
  _viewName?: string;
  _viewDescription?: string;
  _formConfig?: FormViewConfig;
  _tableFields?: TableField[];
  _tableId?: number;
}

export default function FormBlock({
  viewId,
  _viewName = 'Form',
  _viewDescription,
  _formConfig,
  _tableFields = [],
  _tableId,
}: FormBlockProps) {
  // Handle form submission
  const handleSubmit = useCallback(async (formData: Record<string, any>) => {
    try {
      const result = await submitFormView(viewId, formData);
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit form',
      };
    }
  }, [viewId]);

  // If no form configuration is available, show placeholder
  if (!_formConfig || _tableFields.length === 0) {
    return (
      <div className="p-8 border border-dashed rounded-lg text-center">
        <p className="text-muted-foreground">
          {viewId
            ? 'Loading form configuration...'
            : 'Please select a form view in the editor'}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto p-6">
      <MultiPageForm
        viewName={_viewName}
        viewDescription={_viewDescription}
        formConfig={_formConfig}
        tableFields={_tableFields}
        onSubmit={handleSubmit}
        onSuccess={(result) => {
          console.log('Form submitted successfully:', result);
        }}
      />
    </div>
  );
}
