'use client';

/**
 * FormConfigFieldRenderer - Puck sidebar field for configuring form views
 *
 * AIDEV-NOTE: Renders inside the Puck editor sidebar when a FormBlock is selected.
 * Allows users to manage form fields, pages, ordering, and per-field settings.
 * Persists changes via updateFormViewConfig server action.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { FieldLabel } from '@measured/puck';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  GripVertical,
  FileText,
  Settings,
} from 'lucide-react';
import { updateFormViewConfig } from '@/app/actions/views';
import { toast } from 'sonner';

interface FormFieldConfig {
  fieldId: number;
  order: number;
  label?: string;
  helpText?: string;
  placeholder?: string;
  required?: boolean;
  visible?: boolean;
  allowMultiple?: boolean;
  maxFiles?: number;
}

interface FormPageConfig {
  id: string;
  title?: string;
  description?: string;
  fields: FormFieldConfig[];
  order: number;
}

interface FormViewConfig {
  type: 'form';
  pages: FormPageConfig[];
  submitButtonText?: string;
  successMessage?: string;
  redirectUrl?: string;
}

interface TableField {
  id: number;
  name: string;
  type: string;
  required: boolean | null;
}

interface FormConfigFieldRendererProps {
  value: any;
  onChange: (value: any) => void;
  field: { label?: string };
  name: string;
  readOnly?: boolean;
  // Resolved data passed through Puck props
  id?: string;
}

// We receive formConfig and tableFields through a context mechanism
// The FormBlock's resolveFields passes these through the render closure
interface FormConfigFieldRendererWithDataProps extends FormConfigFieldRendererProps {
  formConfig?: FormViewConfig;
  tableFields?: TableField[];
  viewId?: number;
}

export function FormConfigFieldRenderer(props: FormConfigFieldRendererWithDataProps) {
  const { field, formConfig: initialConfig, tableFields, viewId, readOnly } = props;

  const [config, setConfig] = useState<FormViewConfig | null>(initialConfig || null);
  const [saving, setSaving] = useState(false);
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  // Sync with external config changes
  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
    }
  }, [initialConfig]);

  const saveConfig = useCallback(async (newConfig: FormViewConfig) => {
    setConfig(newConfig);

    if (!viewId) return;

    setSaving(true);
    try {
      const result = await updateFormViewConfig(viewId, {
        pages: newConfig.pages,
        submitButtonText: newConfig.submitButtonText,
        successMessage: newConfig.successMessage,
        redirectUrl: newConfig.redirectUrl,
      });
      if (!result.success) {
        toast.error(result.error || 'Failed to save form configuration');
      }
    } catch (err) {
      toast.error('Failed to save form configuration');
    } finally {
      setSaving(false);
    }
  }, [viewId]);

  if (!config || !tableFields) {
    return (
      <FieldLabel label={field.label || 'Form Configuration'}>
        <div className="text-xs text-muted-foreground p-2 border rounded-md">
          Select a form view first to configure fields.
        </div>
      </FieldLabel>
    );
  }

  const isFileField = (fieldType: string) => fieldType === 'file' || fieldType === 'document';

  // Get table field info by ID
  const getTableField = (fieldId: number) => tableFields.find(f => f.id === fieldId);

  // Get fields not included in any page
  const includedFieldIds = new Set(
    config.pages.flatMap(p => p.fields.map(f => f.fieldId))
  );
  const availableFields = tableFields.filter(
    f => !includedFieldIds.has(f.id) && f.type !== 'autonumber' && f.type !== 'created-at' && f.type !== 'last-updated' && f.type !== 'embedding'
  );

  // Field ordering helpers
  const moveFieldUp = (pageIndex: number, fieldIndex: number) => {
    if (fieldIndex === 0) return;
    const newConfig = { ...config };
    const page = { ...newConfig.pages[pageIndex] };
    const fields = [...page.fields];
    [fields[fieldIndex - 1], fields[fieldIndex]] = [fields[fieldIndex], fields[fieldIndex - 1]];
    // Update order values
    fields.forEach((f, i) => { f.order = i; });
    page.fields = fields;
    newConfig.pages = [...newConfig.pages];
    newConfig.pages[pageIndex] = page;
    saveConfig(newConfig);
  };

  const moveFieldDown = (pageIndex: number, fieldIndex: number) => {
    const page = config.pages[pageIndex];
    if (fieldIndex >= page.fields.length - 1) return;
    const newConfig = { ...config };
    const newPage = { ...newConfig.pages[pageIndex] };
    const fields = [...newPage.fields];
    [fields[fieldIndex], fields[fieldIndex + 1]] = [fields[fieldIndex + 1], fields[fieldIndex]];
    fields.forEach((f, i) => { f.order = i; });
    newPage.fields = fields;
    newConfig.pages = [...newConfig.pages];
    newConfig.pages[pageIndex] = newPage;
    saveConfig(newConfig);
  };

  // Add field to page
  const addFieldToPage = (pageIndex: number, fieldId: number) => {
    const tableField = getTableField(fieldId);
    if (!tableField) return;

    const newConfig = { ...config };
    const page = { ...newConfig.pages[pageIndex] };
    const newField: FormFieldConfig = {
      fieldId,
      order: page.fields.length,
      label: tableField.name,
      required: tableField.required || false,
      visible: true,
    };
    page.fields = [...page.fields, newField];
    newConfig.pages = [...newConfig.pages];
    newConfig.pages[pageIndex] = page;
    saveConfig(newConfig);
  };

  // Remove field from page
  const removeField = (pageIndex: number, fieldIndex: number) => {
    const newConfig = { ...config };
    const page = { ...newConfig.pages[pageIndex] };
    page.fields = page.fields.filter((_, i) => i !== fieldIndex);
    page.fields.forEach((f, i) => { f.order = i; });
    newConfig.pages = [...newConfig.pages];
    newConfig.pages[pageIndex] = page;
    saveConfig(newConfig);
  };

  // Update field config
  const updateField = (pageIndex: number, fieldIndex: number, updates: Partial<FormFieldConfig>) => {
    const newConfig = { ...config };
    const page = { ...newConfig.pages[pageIndex] };
    page.fields = [...page.fields];
    page.fields[fieldIndex] = { ...page.fields[fieldIndex], ...updates };
    newConfig.pages = [...newConfig.pages];
    newConfig.pages[pageIndex] = page;
    saveConfig(newConfig);
  };

  // Page management
  const addPage = () => {
    const newConfig = { ...config };
    const newPage: FormPageConfig = {
      id: crypto.randomUUID(),
      title: `Page ${config.pages.length + 1}`,
      fields: [],
      order: config.pages.length,
    };
    newConfig.pages = [...newConfig.pages, newPage];
    saveConfig(newConfig);
  };

  const removePage = (pageIndex: number) => {
    if (config.pages.length <= 1) {
      toast.error('Form must have at least one page');
      return;
    }
    const newConfig = { ...config };
    newConfig.pages = newConfig.pages.filter((_, i) => i !== pageIndex);
    newConfig.pages.forEach((p, i) => { p.order = i; });
    saveConfig(newConfig);
  };

  const updatePage = (pageIndex: number, updates: Partial<FormPageConfig>) => {
    const newConfig = { ...config };
    newConfig.pages = [...newConfig.pages];
    newConfig.pages[pageIndex] = { ...newConfig.pages[pageIndex], ...updates };
    saveConfig(newConfig);
  };

  // Global settings
  const updateGlobalSettings = (updates: Partial<Pick<FormViewConfig, 'submitButtonText' | 'successMessage' | 'redirectUrl'>>) => {
    const newConfig = { ...config, ...updates };
    saveConfig(newConfig);
  };

  const toggleFieldExpanded = (key: string) => {
    setExpandedFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const sortedPages = [...config.pages].sort((a, b) => a.order - b.order);

  return (
    <FieldLabel label={field.label || 'Form Configuration'}>
      <div className="space-y-2">
        {saving && (
          <div className="text-xs text-muted-foreground animate-pulse">Saving...</div>
        )}

        <Accordion type="multiple" defaultValue={['page-0', 'settings']} className="w-full space-y-1">
          {/* Pages */}
          {sortedPages.map((page, pageIndex) => {
            const sortedFields = [...page.fields].sort((a, b) => a.order - b.order);

            return (
              <AccordionItem key={page.id} value={`page-${pageIndex}`} className="border rounded-md px-2">
                <AccordionTrigger className="text-xs py-1.5 hover:no-underline">
                  <div className="flex items-center gap-1.5 w-full">
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate">{page.title || `Page ${pageIndex + 1}`}</span>
                    <span className="text-muted-foreground ml-auto mr-2 shrink-0">
                      {page.fields.length} fields
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 pb-2">
                  {/* Page title/description */}
                  <div className="space-y-1">
                    <Input
                      value={page.title || ''}
                      onChange={(e) => updatePage(pageIndex, { title: e.target.value })}
                      placeholder="Page title"
                      className="h-7 text-xs"
                      disabled={readOnly}
                    />
                    <Input
                      value={page.description || ''}
                      onChange={(e) => updatePage(pageIndex, { description: e.target.value })}
                      placeholder="Page description (optional)"
                      className="h-7 text-xs"
                      disabled={readOnly}
                    />
                  </div>

                  {/* Fields list */}
                  <div className="space-y-1">
                    {sortedFields.map((fieldConfig, fieldIndex) => {
                      const tableField = getTableField(fieldConfig.fieldId);
                      if (!tableField) return null;

                      const fieldKey = `${pageIndex}-${fieldConfig.fieldId}`;
                      const isExpanded = expandedFields.has(fieldKey);

                      return (
                        <div key={fieldConfig.fieldId} className="border rounded p-1.5 space-y-1">
                          {/* Field row */}
                          <div className="flex items-center gap-1">
                            <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="text-xs truncate flex-1">
                              {fieldConfig.label || tableField.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {tableField.type}
                            </span>

                            {/* Move up/down */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => moveFieldUp(pageIndex, fieldIndex)}
                              disabled={fieldIndex === 0 || readOnly}
                            >
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => moveFieldDown(pageIndex, fieldIndex)}
                              disabled={fieldIndex >= sortedFields.length - 1 || readOnly}
                            >
                              <ChevronDown className="h-3 w-3" />
                            </Button>

                            {/* Settings toggle */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => toggleFieldExpanded(fieldKey)}
                            >
                              <Settings className="h-3 w-3" />
                            </Button>

                            {/* Remove */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                              onClick={() => removeField(pageIndex, fieldIndex)}
                              disabled={readOnly}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>

                          {/* Expanded settings */}
                          {isExpanded && (
                            <div className="pl-4 space-y-1.5 border-l-2 border-muted ml-1">
                              {/* Label override */}
                              <div className="space-y-0.5">
                                <Label className="text-[10px]">Label</Label>
                                <Input
                                  value={fieldConfig.label || ''}
                                  onChange={(e) => updateField(pageIndex, fieldIndex, { label: e.target.value || undefined })}
                                  placeholder={tableField.name}
                                  className="h-6 text-xs"
                                  disabled={readOnly}
                                />
                              </div>

                              {/* Placeholder */}
                              <div className="space-y-0.5">
                                <Label className="text-[10px]">Placeholder</Label>
                                <Input
                                  value={fieldConfig.placeholder || ''}
                                  onChange={(e) => updateField(pageIndex, fieldIndex, { placeholder: e.target.value || undefined })}
                                  placeholder={`Enter ${tableField.name.toLowerCase()}`}
                                  className="h-6 text-xs"
                                  disabled={readOnly}
                                />
                              </div>

                              {/* Help text */}
                              <div className="space-y-0.5">
                                <Label className="text-[10px]">Help text</Label>
                                <Input
                                  value={fieldConfig.helpText || ''}
                                  onChange={(e) => updateField(pageIndex, fieldIndex, { helpText: e.target.value || undefined })}
                                  placeholder="Optional help text"
                                  className="h-6 text-xs"
                                  disabled={readOnly}
                                />
                              </div>

                              {/* Required toggle */}
                              <div className="flex items-center justify-between">
                                <Label className="text-[10px]">Required</Label>
                                <Switch
                                  checked={fieldConfig.required || false}
                                  onCheckedChange={(checked) => updateField(pageIndex, fieldIndex, { required: checked })}
                                  disabled={readOnly}
                                  className="scale-75"
                                />
                              </div>

                              {/* Visible toggle */}
                              <div className="flex items-center justify-between">
                                <Label className="text-[10px]">Visible</Label>
                                <Switch
                                  checked={fieldConfig.visible !== false}
                                  onCheckedChange={(checked) => updateField(pageIndex, fieldIndex, { visible: checked })}
                                  disabled={readOnly}
                                  className="scale-75"
                                />
                              </div>

                              {/* File-specific settings */}
                              {isFileField(tableField.type) && (
                                <>
                                  <div className="flex items-center justify-between">
                                    <Label className="text-[10px]">Allow multiple files</Label>
                                    <Switch
                                      checked={fieldConfig.allowMultiple || false}
                                      onCheckedChange={(checked) => updateField(pageIndex, fieldIndex, { allowMultiple: checked })}
                                      disabled={readOnly}
                                      className="scale-75"
                                    />
                                  </div>
                                  {fieldConfig.allowMultiple && (
                                    <div className="space-y-0.5">
                                      <Label className="text-[10px]">Max files</Label>
                                      <Input
                                        type="number"
                                        min={1}
                                        max={50}
                                        value={fieldConfig.maxFiles || ''}
                                        onChange={(e) => updateField(pageIndex, fieldIndex, {
                                          maxFiles: e.target.value ? parseInt(e.target.value) : undefined,
                                        })}
                                        placeholder="No limit"
                                        className="h-6 text-xs"
                                        disabled={readOnly}
                                      />
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Add field */}
                  {availableFields.length > 0 && (
                    <div className="pt-1">
                      <select
                        className="w-full h-7 text-xs border rounded px-1.5 bg-background"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            addFieldToPage(pageIndex, parseInt(e.target.value));
                          }
                        }}
                        disabled={readOnly}
                      >
                        <option value="">+ Add field...</option>
                        {availableFields.map(f => (
                          <option key={f.id} value={f.id}>
                            {f.name} ({f.type})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Remove page */}
                  {config.pages.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full h-6 text-xs text-destructive hover:text-destructive"
                      onClick={() => removePage(pageIndex)}
                      disabled={readOnly}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Remove Page
                    </Button>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}

          {/* Global Settings */}
          <AccordionItem value="settings" className="border rounded-md px-2">
            <AccordionTrigger className="text-xs py-1.5 hover:no-underline">
              <div className="flex items-center gap-1.5">
                <Settings className="h-3 w-3" />
                Form Settings
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 pb-2">
              <div className="space-y-0.5">
                <Label className="text-[10px]">Submit button text</Label>
                <Input
                  value={config.submitButtonText || ''}
                  onChange={(e) => updateGlobalSettings({ submitButtonText: e.target.value || undefined })}
                  placeholder="Submit"
                  className="h-7 text-xs"
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px]">Success message</Label>
                <Textarea
                  value={config.successMessage || ''}
                  onChange={(e) => updateGlobalSettings({ successMessage: e.target.value || undefined })}
                  placeholder="Form submitted successfully!"
                  className="text-xs min-h-[48px]"
                  rows={2}
                  disabled={readOnly}
                />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px]">Redirect URL (optional)</Label>
                <Input
                  value={config.redirectUrl || ''}
                  onChange={(e) => updateGlobalSettings({ redirectUrl: e.target.value || undefined })}
                  placeholder="https://..."
                  className="h-7 text-xs"
                  disabled={readOnly}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Add Page button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full h-7 text-xs"
          onClick={addPage}
          disabled={readOnly}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Page
        </Button>
      </div>
    </FieldLabel>
  );
}
