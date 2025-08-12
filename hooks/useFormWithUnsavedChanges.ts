'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { z } from 'zod';

// AIDEV-NOTE: Custom hook for managing form state with unsaved changes detection and validation
// AIDEV-NOTE: Provides consistent form handling across Agent and Team forms

export interface UseFormOptions<T> {
  schema: z.ZodSchema<T>;
  defaultValues?: Partial<T>;
  onSubmit: (data: T) => Promise<void>;
  onClose?: () => void;
}

export interface UseFormReturn<T> {
  values: Partial<T>;
  errors: Partial<Record<keyof T, string>>;
  isLoading: boolean;
  isDirty: boolean;
  hasUnsavedChanges: boolean;
  setValue: (key: keyof T, value: any) => void;
  setValues: (values: Partial<T>) => void;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  handleClose: () => void;
  validateField: (key: keyof T) => void;
  clearError: (key: keyof T) => void;
  reset: () => void;
}

export function useFormWithUnsavedChanges<T extends Record<string, any>>({
  schema,
  defaultValues = {},
  onSubmit,
  onClose,
}: UseFormOptions<T>): UseFormReturn<T> {
  const [values, setValuesState] = useState<Partial<T>>(defaultValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const originalValues = useRef<Partial<T>>(defaultValues);

  // Check if there are unsaved changes
  const hasUnsavedChanges = isDirty && JSON.stringify(values) !== JSON.stringify(originalValues.current);

  const setValue = useCallback((key: keyof T, value: any) => {
    setValuesState(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
    // Clear error when user starts typing
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: undefined }));
    }
  }, [errors]);

  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState(newValues);
    setIsDirty(true);
  }, []);

  const validateField = useCallback((key: keyof T) => {
    const value = values[key];
    try {
      // Validate single field by parsing just that field
      schema.parse({ ...values, [key]: value });
      setErrors(prev => ({ ...prev, [key]: undefined }));
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldError = error.errors.find(e => e.path.includes(key as string));
        if (fieldError) {
          setErrors(prev => ({ ...prev, [key]: fieldError.message }));
        }
      }
    }
  }, [schema, values]);

  const clearError = useCallback((key: keyof T) => {
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }, []);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    setIsLoading(true);
    setErrors({});

    try {
      // Validate all data
      const validatedData = schema.parse(values);
      await onSubmit(validatedData);
      
      // Reset dirty state after successful submit
      setIsDirty(false);
      originalValues.current = values;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Partial<Record<keyof T, string>> = {};
        error.errors.forEach(err => {
          const path = err.path[0] as keyof T;
          fieldErrors[path] = err.message;
        });
        setErrors(fieldErrors);
      } else {
        console.error('Form submission error:', error);
        throw error; // Re-throw to allow parent to handle
      }
    } finally {
      setIsLoading(false);
    }
  }, [schema, values, onSubmit]);

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges && onClose) {
      const shouldClose = window.confirm(
        "Are you sure you want to exit? Unsaved changes will be lost."
      );
      if (shouldClose) {
        onClose();
      }
    } else if (onClose) {
      onClose();
    }
  }, [hasUnsavedChanges, onClose]);

  // Stable reference to avoid infinite loops
  const defaultValuesRef = useRef(defaultValues);
  const defaultValuesString = JSON.stringify(defaultValues);

  // Update default values ref when they change
  useEffect(() => {
    if (JSON.stringify(defaultValuesRef.current) !== defaultValuesString) {
      defaultValuesRef.current = defaultValues;
      originalValues.current = defaultValues;
      setValuesState(defaultValues);
      setIsDirty(false);
    }
  }, [defaultValuesString, defaultValues]);

  const reset = useCallback(() => {
    const currentDefaults = defaultValuesRef.current;
    setValuesState(currentDefaults);
    setErrors({});
    setIsDirty(false);
    originalValues.current = currentDefaults;
  }, []);

  // Add beforeunload listener for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  return {
    values,
    errors,
    isLoading,
    isDirty,
    hasUnsavedChanges,
    setValue,
    setValues,
    handleSubmit,
    handleClose,
    validateField,
    clearError,
    reset,
  };
}