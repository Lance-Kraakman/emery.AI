"use client";

/* eslint-disable react-hooks/rules-of-hooks */
import React, { useState, useEffect, useCallback } from "react";
import { AutoField, Button as PuckButton, createUsePuck, FieldLabel, walkTree } from "@measured/puck";
import { Button } from "@/components/ui/button";
import { ComponentConfig, Slot } from "@measured/puck";
import { generateId } from "@/components/puck/lib/generate-id";
import TemplateComponent, { TemplateProps } from "./Template";
import { useLinkContext } from "../../link-context";
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteVariant,
  type TemplateDTO,
} from "@/app/actions/puck-templates";
import type { TemplateVariant } from "@/lib/db/schema";
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

        // Get props, appState, and dispatch from Puck
        const props = usePuck((s) => s.selectedItem?.props) as TemplateProps | undefined;
        const selectedItem = usePuck((s) => s.selectedItem);
        const dispatch = usePuck((s) => s.dispatch);
        const appState = usePuck((s) => s.appState);

        // Get children from zones (for DB templates) or props (for drag-drop)
        // Zone key format: "<componentId>:children"
        const zoneKey = selectedItem?.props?.id ? `${selectedItem.props.id}:children` : null;
        const childrenFromZone = zoneKey ? (appState?.data?.zones?.[zoneKey] as any[] | undefined) : undefined;
        // Use zone data if available, otherwise fall back to props.children
        const children = childrenFromZone && childrenFromZone.length > 0 ? childrenFromZone : props?.children;

        // DEBUG
        console.log('[Template] Render:', {
          value,
          zoneKey,
          childrenFromZone: childrenFromZone?.length,
          propsChildren: Array.isArray(props?.children) ? props.children.length : typeof props?.children,
          children: Array.isArray(children) ? children.length : typeof children,
        });

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

        // Handle template change - dispatches zone updates directly
        // All templates are now DB templates (including system templates)
        const handleTemplateChange = async (newValue: string) => {
          // DEBUG - add stack trace to find what's calling this
          console.log('[Template] handleTemplateChange:', {
            newValue,
            componentId: selectedItem?.props?.id,
            templateFound: newValue.startsWith('db_') ? !!templates.find(t => t.id === parseInt(newValue.replace('db_', ''), 10)) : 'n/a',
            saveDialogOpen,
          });
          if (newValue === 'blank') {
            console.trace('[Template] WHO IS CALLING handleTemplateChange with blank?');
            // If dialog is open, this is a bug - don't change template
            if (saveDialogOpen) {
              console.warn('[Template] BLOCKED: handleTemplateChange called with blank while dialog is open!');
              return;
            }
          }

          const componentId = selectedItem?.props?.id;

          if (!componentId) {
            onChange(newValue);
            return;
          }

          const componentZoneKey = `${componentId}:children`;

          if (newValue === "blank") {
            // Clear zones for blank template
            dispatch({
              type: "setData",
              data: (prev: any) => ({
                ...prev,
                zones: {
                  ...prev.zones,
                  [componentZoneKey]: [],
                },
              }),
            });
          } else if (newValue.startsWith("db_")) {
            // DB template (includes system templates) - load and dispatch
            const templateId = parseInt(newValue.replace("db_", ""), 10);
            const template = templates.find((t) => t.id === templateId);

            if (template) {
              let componentTree = template.data;
              if (template.variants && template.variants.length > 0) {
                const defaultVariant = template.variants.find((v) => v.isDefault) || template.variants[0];
                if (defaultVariant) {
                  componentTree = defaultVariant.data;
                }
              }

              // Generate unique IDs for all components in the tree
              // This is required because template data may not have IDs (system templates)
              // or we need fresh IDs for each instance
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

              // DEBUG
              console.log('[Template] Dispatching zone update:', {
                componentZoneKey,
                childrenCount: children.length,
                childrenTypes: children.map((c: any) => c.type),
              });

              dispatch({
                type: "setData",
                data: (prev: any) => ({
                  ...prev,
                  zones: {
                    ...prev.zones,
                    [componentZoneKey]: children,
                  },
                }),
              });
            }
          }

          onChange(newValue);
        };

        // Handle save new template
        const handleSaveTemplate = async () => {
          // DEBUG
          console.log('[Template] handleSaveTemplate:', {
            zoneKey,
            childrenFromZone: childrenFromZone?.length,
            propsChildren: Array.isArray(props?.children) ? props.children.length : typeof props?.children,
            children: Array.isArray(children) ? children.length : typeof children,
          });

          if (!children || (Array.isArray(children) && children.length === 0)) {
            toast.error("No content to save as template");
            return;
          }

          if (!newTemplateName.trim()) {
            toast.error("Please enter a template name");
            return;
          }

          const childrenArray = Array.isArray(children) ? children : [];
          console.log('[Template] childrenArray:', childrenArray.length); // DEBUG
          if (childrenArray.length === 0) {
            toast.error("No content to save as template");
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
              onChange(`db_${result.data.id}`);
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

        // Find current template
        const currentTemplateId = value?.startsWith("db_")
          ? parseInt(value.replace("db_", ""), 10)
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
                      console.log('[Template] Blank button clicked explicitly');
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
                            handleTemplateChange(`db_${template.id}`);
                          }}
                          className={`relative group text-left p-1.5 rounded-md border transition-all ${
                            value === `db_${template.id}`
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border hover:border-muted-foreground/50 hover:bg-accent/50"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {value === `db_${template.id}` && (
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
                            handleTemplateChange(`db_${template.id}`);
                          }}
                          className={`relative group text-left p-1.5 rounded-md border transition-all ${
                            value === `db_${template.id}`
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border hover:border-muted-foreground/50 hover:bg-accent/50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              {value === `db_${template.id}` && (
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
                    console.log('[Template] Save as template button clicked');
                    console.log('[Template] Current children before opening dialog:', {
                      childrenFromZone: childrenFromZone?.length,
                      propsChildren: Array.isArray(props?.children) ? props.children.length : typeof props?.children,
                      children: Array.isArray(children) ? children.length : typeof children,
                    });
                    setSaveDialogOpen(true);
                  }}
                  disabled={!children || (Array.isArray(children) && children.length === 0)}
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

        // Get props, appState, and dispatch from Puck
        const props = usePuck((s) => s.selectedItem?.props) as TemplateProps | undefined;
        const selectedItem = usePuck((s) => s.selectedItem);
        const dispatch = usePuck((s) => s.dispatch);
        const appState = usePuck((s) => s.appState);

        // Get children from zones (for DB templates) or props (for drag-drop)
        const zoneKey = selectedItem?.props?.id ? `${selectedItem.props.id}:children` : null;
        const childrenFromZone = zoneKey ? (appState?.data?.zones?.[zoneKey] as any[] | undefined) : undefined;
        const children = childrenFromZone && childrenFromZone.length > 0 ? childrenFromZone : props?.children;

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

        // Get current template (all templates are now DB templates)
        const currentTemplateId = templateValue?.startsWith("db_")
          ? parseInt(templateValue.replace("db_", ""), 10)
          : null;
        const currentDbTemplate = currentTemplateId
          ? templates.find((t) => t.id === currentTemplateId)
          : null;

        // Only show for templates with variants
        if (!currentDbTemplate || currentDbTemplate.variants.length === 0) {
          return <></>;
        }

        // System templates can't be modified - only show variant selection
        const isSystemTemplate = currentDbTemplate.isSystem;

        const selectedVariantId = value || currentDbTemplate.variants.find((v) => v.isDefault)?.id || currentDbTemplate.variants[0]?.id;

        // Handle save as variant
        const handleSaveVariant = async () => {
          const childrenArray = Array.isArray(children) ? children : [];
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
          const childrenArray = Array.isArray(children) ? children : [];
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
                {/* Variant cards - vertical stack */}
                <div className="flex flex-col gap-1.5">
                  {currentDbTemplate.variants.map((variant) => (
                    <button
                      key={variant.id}
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
                      onClick={() => setAddingVariant(true)}
                      disabled={!children || (Array.isArray(children) && children.length === 0)}
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
                    disabled={updatingVariant || !children || (Array.isArray(children) && children.length === 0)}
                    className="w-full h-7 text-xs"
                  >
                    {updatingVariant && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    Update "{currentDbTemplate.variants.find((v) => v.id === selectedVariantId)?.name}"
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
    _expandedChildren: undefined,
  },
  // Note: resolveData cannot update zones (slots), so we handle zone updates
  // via dispatch in handleTemplateChange. This resolveData is kept minimal.
  resolveData: async (data) => {
    return data;
  },
  render: TemplateComponent,
};

export const Template = TemplateInternal;
