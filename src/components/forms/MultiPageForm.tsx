'use client';

/**
 * MultiPageForm - Container for multi-page forms
 *
 * AIDEV-NOTE: Manages form state, validation, and submission across multiple pages.
 * Provides navigation between pages and tracks form progress.
 * Uses FormPage component to render individual pages.
 */

import { useState, useCallback, useMemo } from 'react';
import { FormPage, type FormPageConfig, type TableField } from './FormPage';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';

// Re-export types for use in other components
export type { TableField, FormPageConfig } from './FormPage';

export interface FormViewConfig {
  type: 'form';
  pages: FormPageConfig[];
  submitButtonText?: string;
  successMessage?: string;
  redirectUrl?: string;
}

export interface MultiPageFormProps {
  viewName: string;
  viewDescription?: string;
  formConfig: FormViewConfig;
  tableFields: TableField[];
  onSubmit: (formData: Record<string, any>) => Promise<{ success: boolean; error?: string }>;
  onSuccess?: (result: any) => void;
  className?: string;
  // Custom components for puck theme support
  customButton?: React.ComponentType<any>;
  customProgress?: React.ComponentType<any>;
  customStyles?: {
    container?: string;
    header?: string;
    title?: string;
    description?: string;
    progressSection?: string;
    form?: string;
    error?: string;
    errorText?: string;
    buttonGroup?: string;
    successContainer?: string;
    successIcon?: string;
    successIconCircle?: string;
    successContent?: string;
    successTitle?: string;
    successMessage?: string;
  };
}

export function MultiPageForm({
  viewName,
  viewDescription,
  formConfig,
  tableFields,
  onSubmit,
  onSuccess,
  className,
  customButton,
  customProgress,
  customStyles = {},
}: MultiPageFormProps) {
  // Use custom components or fallback to shadcn/ui with wrappers
  const ButtonComponent = customButton || (({ variant, ...props }: any) => (
    <Button
      {...props}
      variant={variant === 'primary' ? 'default' : variant}
    />
  ));

  const ProgressComponent = customProgress || (({ value, label, showPercentage, ...props }: any) => (
    <div className="space-y-2">
      {(label || showPercentage) && (
        <div className="flex justify-between text-sm text-muted-foreground">
          {label && <span>{label}</span>}
          {showPercentage && <span>{Math.round(value)}% Complete</span>}
        </div>
      )}
      <Progress value={value} {...props} className="h-2" />
    </div>
  ));
  // State
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Memoized values
  const sortedPages = useMemo(() => {
    return [...formConfig.pages].sort((a, b) => a.order - b.order);
  }, [formConfig.pages]);

  const currentPage = sortedPages[currentPageIndex];
  const isFirstPage = currentPageIndex === 0;
  const isLastPage = currentPageIndex === sortedPages.length - 1;
  const progress = ((currentPageIndex + 1) / sortedPages.length) * 100;

  /**
   * Handle field value change
   */
  const handleFieldChange = useCallback((fieldName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value,
    }));

    // Clear error for this field when user makes changes
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  }, [errors]);

  /**
   * Validate current page fields
   */
  const validateCurrentPage = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    // Get all fields on current page
    for (const fieldConfig of currentPage.fields) {
      const tableField = tableFields.find(f => f.id === fieldConfig.fieldId);
      if (!tableField) continue;

      const fieldName = tableField.name;
      const fieldValue = formData[fieldName];

      // Check if field is required
      const isRequired = fieldConfig.required !== undefined
        ? fieldConfig.required
        : (tableField.required ?? false);

      if (isRequired && (fieldValue === undefined || fieldValue === null || fieldValue === '')) {
        const label = fieldConfig.label || tableField.name;
        newErrors[fieldName] = `${label} is required`;
      }

      // TODO: Add validation rules from fieldConfig.validationRules
      // (min, max, pattern, email, url, etc.)
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [currentPage, tableFields, formData]);

  /**
   * Handle next page navigation
   */
  const handleNext = useCallback(() => {
    if (!validateCurrentPage()) {
      return;
    }

    if (!isLastPage) {
      setCurrentPageIndex(prev => prev + 1);
      // Scroll to top of form
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [validateCurrentPage, isLastPage]);

  /**
   * Handle previous page navigation
   */
  const handlePrevious = useCallback(() => {
    if (!isFirstPage) {
      setCurrentPageIndex(prev => prev - 1);
      // Scroll to top of form
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [isFirstPage]);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate current page before submitting
    if (!validateCurrentPage()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const result = await onSubmit(formData);

      if (result.success) {
        setIsSuccess(true);
        if (onSuccess) {
          onSuccess(result);
        }

        // Redirect if configured
        if (formConfig.redirectUrl) {
          window.location.href = formConfig.redirectUrl;
        }
      } else {
        setErrors({
          _form: result.error || 'Failed to submit form',
        });
      }
    } catch (error) {
      setErrors({
        _form: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [validateCurrentPage, formData, onSubmit, onSuccess, formConfig.redirectUrl]);

  // Show success message if submission was successful
  if (isSuccess) {
    const successMessage = formConfig.successMessage || 'Form submitted successfully!';
    return (
      <div className={customStyles.successContainer || cn("space-y-6 p-8 bg-background rounded-lg border", className)}>
        <div className={customStyles.successIcon || "flex items-center justify-center"}>
          <div className={customStyles.successIconCircle || "rounded-full bg-green-100 p-3"}>
            <Check className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <div className={customStyles.successContent || "text-center space-y-2"}>
          <h2 className={customStyles.successTitle || "text-2xl font-bold"}>Success!</h2>
          <p className={customStyles.successMessage || "text-muted-foreground"}>{successMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={customStyles.container || cn("space-y-6", className)}>
      {/* Form Header */}
      <div className={customStyles.header || "space-y-2"}>
        <h1 className={customStyles.title || "text-3xl font-bold"}>{viewName}</h1>
        {viewDescription && (
          <p className={customStyles.description || "text-muted-foreground"}>{viewDescription}</p>
        )}
      </div>

      {/* Progress Indicator (for multi-page forms) */}
      {sortedPages.length > 1 && (
        <ProgressComponent
          value={progress}
          max={100}
          label={`Step ${currentPageIndex + 1} of ${sortedPages.length}`}
          showPercentage={true}
        />
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Current Page */}
        <FormPage
          page={currentPage}
          tableFields={tableFields}
          formData={formData}
          errors={errors}
          onChange={handleFieldChange}
        />

        {/* Form-level error */}
        {errors._form && (
          <div className={customStyles.error || "p-4 bg-destructive/10 border border-destructive rounded-md"}>
            <p className={customStyles.errorText || "text-sm text-destructive"}>{errors._form}</p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className={customStyles.buttonGroup || "flex items-center justify-between pt-4"}>
          <ButtonComponent
            type="button"
            variant="secondary"
            onClick={handlePrevious}
            disabled={isFirstPage || isSubmitting}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </ButtonComponent>

          {isLastPage ? (
            <ButtonComponent
              type="submit"
              variant="primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : (formConfig.submitButtonText || 'Submit')}
            </ButtonComponent>
          ) : (
            <ButtonComponent
              type="button"
              variant="primary"
              onClick={handleNext}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </ButtonComponent>
          )}
        </div>
      </form>
    </div>
  );
}
