"use client";

/* eslint-disable react-hooks/rules-of-hooks */
import React, { useState, useEffect, useCallback } from "react";
import { Button as PuckButton, createUsePuck, FieldLabel, walkTree } from "@measured/puck";
import { Button } from "@/components/ui/button";
import { ComponentConfig, Slot } from "@measured/puck";
import { generateId } from "@/components/puck/lib/generate-id";
import TemplateComponent, { TemplateProps } from "./Template";
import { useLinkContext } from "../../contexts/PageContext";
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteVariant,
  type TemplateDTO,
} from "@/app/actions/puck-templates";
import type { TemplateVariant } from "@/ddd/infrastructure/db/schema";
import { ShareDialog } from "@/components/permissions/ShareDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Share2, Plus, X, Check } from "lucide-react";
import { toast } from "sonner";

const usePuck = createUsePuck();

// Categories for grouping templates
const CATEGORIES = [
  { value: "layout", label: "Layout" },
  { value: "content", label: "Content" },
  { value: "data", label: "Data" },
  { value: "forms", label: "Forms" },
  { value: "navigation", label: "Navigation" },
  { value: "other", label: "Other" },
];

export const TemplateInternal: ComponentConfig<TemplateProps> = {
  fields: {
    template: {
      type: "custom",
      render: ({ name, value, onChange }) => {
        const linkContext = useLinkContext();
        const appId = linkContext.appId;

        // Get props from Puck
        const props = usePuck((s) => s.selectedItem?.props) as TemplateProps | undefined;

        const [templates, setTemplates] = useState<TemplateDTO[]>([]);
        const [loading, setLoading] = useState(true);
        const [saving, setSaving] = useState(false);

        // Save dialog state
        const [saveDialogOpen, setSaveDialogOpen] = useState(false);
        const [newTemplateName, setNewTemplateName] = useState("");
        const [newTemplateDescription, setNewTemplateDescription] = useState("");
        const [newTemplateCategory, setNewTemplateCategory] = useState("other");
        const [newTemplateScope, setNewTemplateScope] = useState<"org" | "app">("org");

        // Share dialog state
        const [shareDialogOpen, setShareDialogOpen] = useState(false);
        const [shareTemplate, setShareTemplate] = useState<TemplateDTO | null>(null);

        // Load templates from database
        const loadTemplates = useCallback(async () => {
          setLoading(true);
          try {
            const result = await getTemplates(appId);
            if (result.success && result.data) {
              setTemplates(result.data);
            } else {
              console.error("Failed to load templates:", result.error);
            }
          } catch (error) {
            console.error("Error loading templates:", error);
          } finally {
            setLoading(false);
          }
        }, [appId]);

        useEffect(() => {
          loadTemplates();
        }, [loadTemplates]);

        // Handle template change - just call onChange, resolveData handles loading
        const handleTemplateChange = (newValue: string) => {
          if (newValue === 'blank' && saveDialogOpen) {
            return;
          }
          onChange(newValue);
        };

        // Handle save new template
        const handleSaveTemplate = async () => {
          const childrenArray = Array.isArray(props?.children) ? props.children : [];
          if (childrenArray.length === 0) {
            toast.error("No content to save as template");
            return;
          }

          if (!newTemplateName.trim()) {
            toast.error("Please enter a template name");
            return;
          }

          setSaving(true);
          try {
            const { conf: config } = await import("../../index");

            const data = childrenArray.map((child: any) =>
              walkTree(
                {
                  type: child.type,
                  props: { ...child.props, id: generateId(child.type) },
                },
                config,
                (content) =>
                  content.map((item) => ({
                    ...item,
                    props: { ...item.props, id: generateId(item.type) },
                  }))
              )
            );

            const result = await createTemplate({
              name: newTemplateName.trim(),
              description: newTemplateDescription.trim() || undefined,
              category: newTemplateCategory,
              appId: newTemplateScope === "app" ? appId ?? null : null,
              data,
            });

            if (result.success && result.data) {
              toast.success("Template saved successfully");
              setSaveDialogOpen(false);
              setNewTemplateName("");
              setNewTemplateDescription("");
              setNewTemplateCategory("other");
              await loadTemplates();
              onChange(String(result.data.id));
            } else {
              toast.error(result.error || "Failed to save template");
            }
          } catch (error) {
            console.error("Error saving template:", error);
            toast.error("Failed to save template");
          } finally {
            setSaving(false);
          }
        };

        // Find current template - value is "blank" or template ID as string
        const currentTemplateId = value && value !== "blank"
          ? parseInt(value, 10)
          : null;
        const currentTemplate = currentTemplateId
          ? templates.find((t) => t.id === currentTemplateId)
          : null;

        // Separate system templates from user templates for UI grouping
        const systemTemplates = templates.filter((t) => t.isSystem);
        const userTemplates = templates.filter((t) => !t.isSystem);

        // Handle share click
        const handleShareClick = (template: TemplateDTO, e: React.MouseEvent) => {
          e.stopPropagation();
          setShareTemplate(template);
          setShareDialogOpen(true);
        };

        // Check if we have content to save
        const hasContent = Array.isArray(props?.children) && props.children.length > 0;

        return (
          <FieldLabel label={name}>
            <div className="space-y-3">
              {loading ? (
                <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-muted/50">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading...</span>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto pr-1">
                  {/* Blank option */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTemplateChange("blank");
                    }}
                    className={`relative group text-left p-1.5 rounded-md border transition-all ${
                      value === "blank" || !value
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-muted-foreground/50 hover:bg-accent/50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {(value === "blank" || !value) && (
                        <Check className="h-3 w-3 text-primary shrink-0" />
                      )}
                      <span className="text-xs font-medium">Blank</span>
                    </div>
                  </button>

                  {/* System templates section */}
                  {systemTemplates.length > 0 && (
                    <>
                      <div className="mt-2 mb-1">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">System</span>
                      </div>
                      {systemTemplates.map((template) => (
                        <button
                          type="button"
                          key={template.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTemplateChange(String(template.id));
                          }}
                          className={`relative group text-left p-1.5 rounded-md border transition-all ${
                            value === String(template.id)
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border hover:border-muted-foreground/50 hover:bg-accent/50"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {value === String(template.id) && (
                              <Check className="h-3 w-3 text-primary shrink-0" />
                            )}
                            <span className="text-xs font-medium">{template.name}</span>
                          </div>
                        </button>
                      ))}
                    </>
                  )}

                  {/* Saved templates section */}
                  {userTemplates.length > 0 && (
                    <>
                      <div className="mt-2 mb-1">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Saved</span>
                      </div>
                      {userTemplates.map((template) => (
                        <button
                          type="button"
                          key={template.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTemplateChange(String(template.id));
                          }}
                          className={`relative group text-left p-1.5 rounded-md border transition-all ${
                            value === String(template.id)
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border hover:border-muted-foreground/50 hover:bg-accent/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              {value === String(template.id) && (
                                <Check className="h-3 w-3 text-primary shrink-0" />
                              )}
                              <span className="text-xs font-medium truncate">{template.name}</span>
                            </div>
                            {/* Share button - only for user templates */}
                            <button
                              type="button"
                              onClick={(e) => handleShareClick(template, e)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-accent transition-all shrink-0"
                              title="Share template"
                            >
                              <Share2 className="h-3 w-3" />
                            </button>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* Template info for DB templates */}
              {currentTemplate && (
                <div className="text-xs text-muted-foreground px-1">
                  {currentTemplate.description && (
                    <p className="mb-1">{currentTemplate.description}</p>
                  )}
                  <p>
                    Category: {CATEGORIES.find((c) => c.value === currentTemplate.category)?.label || currentTemplate.category || "Other"}
                    {currentTemplate.appId ? " • App-specific" : " • Organization-wide"}
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col gap-2">
                <PuckButton
                  variant="secondary"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setSaveDialogOpen(true);
                  }}
                  disabled={!hasContent}
                >
                  Save as template
                </PuckButton>
              </div>
            </div>

            {/* Save Template Dialog */}
            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save as Template</DialogTitle>
                  <DialogDescription>
                    Save the current content as a reusable template.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="template-name">Name</Label>
                    <Input
                      id="template-name"
                      placeholder="My Template"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-description">Description (optional)</Label>
                    <Input
                      id="template-description"
                      placeholder="A brief description..."
                      value={newTemplateDescription}
                      onChange={(e) => setNewTemplateDescription(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-category">Category</Label>
                    <Select
                      value={newTemplateCategory}
                      onValueChange={setNewTemplateCategory}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-scope">Visibility</Label>
                    <Select
                      value={newTemplateScope}
                      onValueChange={(v) => setNewTemplateScope(v as "org" | "app")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select visibility" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="org">Organization-wide</SelectItem>
                        <SelectItem value="app">This app only</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {newTemplateScope === "org"
                        ? "Available across all apps in your organization"
                        : "Only available in this app"}
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setSaveDialogOpen(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSaveTemplate} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save Template
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Share Dialog */}
            {shareTemplate && (
              <ShareDialog
                open={shareDialogOpen}
                onOpenChange={setShareDialogOpen}
                resourceType="template"
                resourceId={shareTemplate.id}
                resourceName={shareTemplate.name}
              />
            )}
          </FieldLabel>
        );
      },
    },
    selectedVariant: {
      type: "custom",
      render: ({ value, onChange }) => {
        const linkContext = useLinkContext();
        const appId = linkContext.appId;

        // Get props from Puck
        const props = usePuck((s) => s.selectedItem?.props) as TemplateProps | undefined;
        const templateValue = props?.template;

        const [templates, setTemplates] = useState<TemplateDTO[]>([]);
        const [loading, setLoading] = useState(true);

        // Inline add variant state
        const [addingVariant, setAddingVariant] = useState(false);
        const [newVariantName, setNewVariantName] = useState("");
        const [newVariantDescription, setNewVariantDescription] = useState("");
        const [savingVariant, setSavingVariant] = useState(false);
        const [deletingVariantId, setDeletingVariantId] = useState<string | null>(null);
        const [updatingVariant, setUpdatingVariant] = useState(false);

        // Load templates
        const loadTemplates = useCallback(async () => {
          setLoading(true);
          try {
            const result = await getTemplates(appId);
            if (result.success && result.data) {
              setTemplates(result.data);
            }
          } finally {
            setLoading(false);
          }
        }, [appId]);

        useEffect(() => {
          loadTemplates();
        }, [loadTemplates]);

        // Get current template - value is "blank" or template ID as string
        const currentTemplateId = templateValue && templateValue !== "blank"
          ? parseInt(templateValue, 10)
          : null;
        const currentDbTemplate = currentTemplateId
          ? templates.find((t) => t.id === currentTemplateId)
          : null;

        // Hide if no template selected
        if (!currentDbTemplate) {
          return <></>;
        }

        // System templates without variants - hide variant UI
        if (currentDbTemplate.isSystem && currentDbTemplate.variants.length === 0) {
          return <></>;
        }

        // System templates can't be modified - only show variant selection
        const isSystemTemplate = currentDbTemplate.isSystem;

        const selectedVariantId = value || currentDbTemplate.variants.find((v) => v.isDefault)?.id || currentDbTemplate.variants[0]?.id;

        // Check if we have content
        const hasContent = Array.isArray(props?.children) && props.children.length > 0;

        // Handle save as variant
        const handleSaveVariant = async () => {
          const childrenArray = Array.isArray(props?.children) ? props.children : [];
          if (childrenArray.length === 0) {
            toast.error("No content to save as variant");
            return;
          }

          if (!newVariantName.trim()) {
            toast.error("Please enter a variant name");
            return;
          }

          setSavingVariant(true);
          try {
            const { conf: config } = await import("../../index");

            const variantData = childrenArray.map((child: any) =>
              walkTree(
                {
                  type: child.type,
                  props: { ...child.props, id: generateId(child.type) },
                },
                config,
                (content) =>
                  content.map((item) => ({
                    ...item,
                    props: { ...item.props, id: generateId(item.type) },
                  }))
              )
            );

            const newVariant: TemplateVariant = {
              id: `variant_${Date.now()}`,
              name: newVariantName.trim(),
              description: newVariantDescription.trim() || undefined,
              data: variantData,
              isDefault: currentDbTemplate.variants.length === 0,
            };

            const result = await updateTemplate({
              id: currentDbTemplate.id,
              variants: [...currentDbTemplate.variants, newVariant],
            });

            if (result.success) {
              toast.success("Variant saved");
              setAddingVariant(false);
              setNewVariantName("");
              setNewVariantDescription("");
              await loadTemplates();
              onChange(newVariant.id);
            } else {
              toast.error(result.error || "Failed to save variant");
            }
          } catch (error) {
            console.error("Error saving variant:", error);
            toast.error("Failed to save variant");
          } finally {
            setSavingVariant(false);
          }
        };

        // Handle delete variant
        const handleDeleteVariant = async (variantId: string) => {
          if (currentDbTemplate.variants.length <= 1) {
            toast.error("Cannot delete the last variant");
            return;
          }

          setDeletingVariantId(variantId);
          try {
            const result = await deleteVariant(currentDbTemplate.id, variantId);

            if (result.success) {
              toast.success("Variant deleted");
              await loadTemplates();
              // If we deleted the selected variant, switch to the first remaining one
              if (variantId === selectedVariantId && result.data) {
                const firstVariant = result.data.variants[0];
                if (firstVariant) {
                  onChange(firstVariant.id);
                }
              }
            } else {
              toast.error(result.error || "Failed to delete variant");
            }
          } catch (error) {
            console.error("Error deleting variant:", error);
            toast.error("Failed to delete variant");
          } finally {
            setDeletingVariantId(null);
          }
        };

        // Handle update variant
        const handleUpdateVariant = async () => {
          const childrenArray = Array.isArray(props?.children) ? props.children : [];
          if (childrenArray.length === 0) {
            toast.error("No content to save");
            return;
          }

          if (!selectedVariantId) {
            toast.error("No variant selected");
            return;
          }

          setUpdatingVariant(true);
          try {
            const { conf: config } = await import("../../index");

            const variantData = childrenArray.map((child: any) =>
              walkTree(
                {
                  type: child.type,
                  props: { ...child.props, id: generateId(child.type) },
                },
                config,
                (content) =>
                  content.map((item) => ({
                    ...item,
                    props: { ...item.props, id: generateId(item.type) },
                  }))
              )
            );

            // Update the specific variant in the array
            const updatedVariants = currentDbTemplate.variants.map((v) =>
              v.id === selectedVariantId
                ? { ...v, data: variantData }
                : v
            );

            const result = await updateTemplate({
              id: currentDbTemplate.id,
              variants: updatedVariants,
            });

            if (result.success) {
              toast.success("Variant updated");
              await loadTemplates();
            } else {
              toast.error(result.error || "Failed to update variant");
            }
          } catch (error) {
            console.error("Error updating variant:", error);
            toast.error("Failed to update variant");
          } finally {
            setUpdatingVariant(false);
          }
        };

        return (
          <FieldLabel label="Variants">
            {loading ? (
              <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-muted/50">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {/* Empty state for user templates without variants */}
                {currentDbTemplate.variants.length === 0 && !isSystemTemplate && (
                  <p className="text-xs text-muted-foreground mb-2">
                    No variants yet. Add one to save different versions.
                  </p>
                )}

                {/* Variant cards - vertical stack */}
                <div className="flex flex-col gap-1.5">
                  {currentDbTemplate.variants.map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => onChange(variant.id)}
                      className={`relative group text-left p-1.5 rounded-md border transition-all ${
                        variant.id === selectedVariantId
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-muted-foreground/50 hover:bg-accent/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          {variant.id === selectedVariantId && (
                            <Check className="h-3 w-3 text-primary shrink-0" />
                          )}
                          <span className="text-xs font-medium truncate">
                            {variant.name}
                          </span>
                          {variant.description && (
                            <span className="text-xs text-muted-foreground truncate">
                              — {variant.description}
                            </span>
                          )}
                        </div>
                        {/* Delete button - only show for user templates with more than 1 variant */}
                        {!isSystemTemplate && currentDbTemplate.variants.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteVariant(variant.id);
                            }}
                            disabled={deletingVariantId === variant.id}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-all shrink-0"
                            title="Delete variant"
                          >
                            {deletingVariantId === variant.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </button>
                  ))}

                  {/* Add variant button - only for user templates */}
                  {!isSystemTemplate && !addingVariant && (
                    <button
                      type="button"
                      onClick={() => setAddingVariant(true)}
                      disabled={!hasContent}
                      className="flex items-center justify-center gap-1 p-1.5 rounded-md border border-dashed border-border hover:border-muted-foreground/50 hover:bg-accent/50 text-muted-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="h-3 w-3" />
                      <span className="text-xs">Add variant</span>
                    </button>
                  )}
                </div>

                {/* Inline add variant form */}
                {addingVariant && (
                  <div className="space-y-2 p-2 border rounded-md bg-muted/30">
                    <Input
                      placeholder="Variant name"
                      value={newVariantName}
                      onChange={(e) => setNewVariantName(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                    />
                    <Input
                      placeholder="Description (optional)"
                      value={newVariantDescription}
                      onChange={(e) => setNewVariantDescription(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAddingVariant(false);
                          setNewVariantName("");
                          setNewVariantDescription("");
                        }}
                        disabled={savingVariant}
                        className="flex-1 h-7 text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveVariant}
                        disabled={savingVariant || !newVariantName.trim()}
                        className="flex-1 h-7 text-xs"
                      >
                        {savingVariant && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                        Add
                      </Button>
                    </div>
                  </div>
                )}

                {/* Update variant button - only for user templates */}
                {!isSystemTemplate && selectedVariantId && currentDbTemplate.variants.length > 0 && !addingVariant && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleUpdateVariant}
                    disabled={updatingVariant || !hasContent}
                    className="w-full h-7 text-xs"
                  >
                    {updatingVariant && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    Update &quot;{currentDbTemplate.variants.find((v) => v.id === selectedVariantId)?.name}&quot;
                  </Button>
                )}
              </div>
            )}
          </FieldLabel>
        );
      },
    },
    children: {
      type: "slot",
    },
  },
  defaultProps: {
    template: "blank",
    selectedVariant: undefined,
    children: [],
  },
  resolveData: async (data, { changed }, context?: { isPublicPage?: boolean; isPreview?: boolean }) => {
    // In preview/public mode, preserve user edits - no API calls
    if (context?.isPublicPage || context?.isPreview) {
      console.log('[Template] Preview/Public mode - preserving user edits, no API calls');
      return data;
    }
    
    // Edit mode: Only resolve when template or variant is explicitly changed by user
    // Do NOT resolve on load - keep existing children (snapshot behavior)
    if (!changed.template && !changed.selectedVariant) {
      return data;
    }

    const templateValue = data.props.template;

    // Blank template - clear children
    if (!templateValue || templateValue === "blank") {
      return {
        ...data,
        props: { ...data.props, children: [] }
      };
    }

    // Load template by ID
    const templateId = parseInt(templateValue, 10);
    if (isNaN(templateId)) {
      return data;
    }

    try {
      const result = await getTemplates();
      if (!result.success || !result.data) {
        return data;
      }

      const template = result.data.find(t => t.id === templateId);
      if (!template) {
        return data;
      }

      // Get variant data or default template data
      let componentTree = template.data;
      let variantId = data.props.selectedVariant;

      if (template.variants && template.variants.length > 0) {
        const variant = data.props.selectedVariant
          ? template.variants.find(v => v.id === data.props.selectedVariant)
          : template.variants.find(v => v.isDefault) || template.variants[0];

        if (variant) {
          componentTree = variant.data;
          variantId = variant.id;
        }
      }

      // Generate fresh IDs for all components
      const { conf: config } = await import("../../index");
      const children = componentTree.map((item: any) =>
        walkTree(
          { type: item.type, props: { ...item.props, id: generateId(item.type) } },
          config,
          (content) => content.map((child) => ({
            ...child,
            props: { ...child.props, id: generateId(child.type) },
          }))
        )
      );

      return {
        ...data,
        props: {
          ...data.props,
          selectedVariant: variantId,
          children
        }
      };
    } catch (error) {
      console.error("Error loading template in resolveData:", error);
      return data;
    }
  },
  render: TemplateComponent,
};

export const Template = TemplateInternal;
