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
import { Section } from '@/components/puck/components/Section';
import styles from './styles.module.css';
import { Button } from './Button';
import { Progress } from './Progress';

export interface FormBlockProps {
  viewId?: number;

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
    if (!viewId) {
      return {
        success: false,
        error: 'No form view selected',
      };
    }
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
      <Section>
        <div className={styles.placeholder}>
          <p className={styles.placeholderText}>
            {viewId
              ? 'Loading form configuration...'
              : 'Please select a form view in the editor'}
          </p>
        </div>
      </Section>
    );
  }

  return (
    <Section>
      <div className={styles.formBlockContainer}>
        <MultiPageForm
          formConfig={_formConfig}
          tableFields={_tableFields}
          onSubmit={handleSubmit}
          onSuccess={(result) => {
            console.log('Form submitted successfully:', result);
          }}
          customButton={Button}
          customProgress={Progress}
          customStyles={{
            container: styles.formWrapper,
            error: styles.errorMessage,
            errorText: styles.errorText,
            buttonGroup: styles.buttonGroup,
            successContainer: styles.successContainer,
            successIcon: styles.successIcon,
            successIconCircle: styles.successIconCircle,
            successContent: styles.successContent,
            successTitle: styles.successTitle,
            successMessage: styles.successMessage,
          }}
          inputThemeClasses={{
            input: styles.input,
            label: styles.fieldLabel,
            fieldGroup: styles.fieldGroup,
            select: styles.select,
            checkbox: styles.checkboxWrapper,
            error: styles.fieldError,
          }}
        />
      </div>
    </Section>
  );
}
