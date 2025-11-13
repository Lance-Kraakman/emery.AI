/**
 * ThemeSidebarPanel - Compact Theme Configuration UI for Puck Sidebar
 *
 * AIDEV-NOTE: Used in Puck editor sidebar (right panel).
 * Provides accordion interface for editing theme configuration (colors, typography, layout).
 * Supports both app-level themes and page-level overrides.
 */

"use client";

import * as React from "react";
import { useForm } from "@tanstack/react-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ColorInput } from "@/components/ui/color-input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FontSelect } from "@/components/ui/font-select";
import {
  ThemeConfig,
  type ThemeConfigProps,
  DEFAULT_THEME,
} from "@/ddd/domain/puck/value-objects/theme-config";
import { THEME_PRESETS, matchesPreset } from "@/components/puck/theme-presets";

export interface ThemeSidebarPanelProps {
  initialTheme: any | undefined; // ThemeConfigProps from DTO
  onSave: (theme: ThemeConfigProps | undefined) => Promise<void>;
  mode: "app" | "page";
}

export function ThemeSidebarPanel({
  initialTheme,
  onSave,
  mode,
}: ThemeSidebarPanelProps) {
  const [isSaving, setIsSaving] = React.useState(false);
  const [selectedPreset, setSelectedPreset] = React.useState<string>("custom");

  // Initialize form with current theme or default
  const currentTheme = initialTheme || DEFAULT_THEME;

  const form = useForm({
    defaultValues: currentTheme,
    onSubmit: async ({ value }) => {
      try {
        setIsSaving(true);
        await onSave(value as ThemeConfigProps);
        // No form.reset() - router.refresh() will reload the page with fresh data
      } catch (error) {
        console.error("Error saving theme:", error);
      } finally {
        setIsSaving(false);
      }
    },
  });

  // Check if current colors match a preset
  React.useEffect(() => {
    const currentColors = form.getFieldValue("colors");
    const matchedPresetId = matchesPreset(currentColors);
    setSelectedPreset(matchedPresetId || "custom");
  }, [form]);

  // Handle preset selection
  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    if (presetId !== "custom") {
      const preset = THEME_PRESETS.find((p) => p.id === presetId);
      if (preset) {
        form.setFieldValue("colors", preset.colors);
      }
    }
  };

  // Reset to default theme
  const handleReset = () => {
    if (mode === "page") {
      // For page mode, reset means clear overrides (save undefined)
      onSave(undefined);
    } else {
      // For app mode, reset to default theme
      form.setFieldValue("colors", DEFAULT_THEME.colors);
      form.setFieldValue("typography", DEFAULT_THEME.typography);
      form.setFieldValue("spacing", DEFAULT_THEME.spacing);
      form.setFieldValue("borders", DEFAULT_THEME.borders);
      setSelectedPreset("custom");
    }
  };

  return (
    <div className="w-full space-y-1 px-2 py-1.5">
      <div>
        <h3 className="text-xs font-semibold">
          {mode === "app" ? "App Theme" : "Page Theme"}
        </h3>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-0.5"
      >
        {/* Colors Section */}
        <Collapsible className="w-full border rounded">
          <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-medium hover:bg-muted/50">
            <span>Colors</span>
            <ChevronDown className="h-3 w-3 transition-transform duration-200 data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-2 pb-1.5 pt-1 max-h-[400px] overflow-y-auto">
            <div className="space-y-1">
              {/* Preset Selector */}
              <div className="space-y-0.5">
                <Label className="text-xs">Palette</Label>
                <Select value={selectedPreset} onValueChange={handlePresetChange}>
                  <SelectTrigger className="h-7 text-xs">
                    <div className="flex items-center gap-1.5 w-full">
                      <span className="flex-1 text-left text-xs">
                        {selectedPreset === "custom"
                          ? "Custom"
                          : THEME_PRESETS.find((p) => p.id === selectedPreset)?.name}
                      </span>
                      {selectedPreset !== "custom" && (
                        <div className="flex gap-0.5">
                          {(() => {
                            const preset = THEME_PRESETS.find((p) => p.id === selectedPreset);
                            return preset ? (
                              <>
                                <div
                                  className="w-3 h-3 rounded-full border border-gray-200"
                                  style={{ backgroundColor: preset.colors.primary }}
                                  title="Primary"
                                />
                                <div
                                  className="w-3 h-3 rounded-full border border-gray-200"
                                  style={{ backgroundColor: preset.colors.secondary }}
                                  title="Secondary"
                                />
                                <div
                                  className="w-3 h-3 rounded-full border border-gray-200"
                                  style={{ backgroundColor: preset.colors.success }}
                                  title="Success"
                                />
                              </>
                            ) : null;
                          })()}
                        </div>
                      )}
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">
                      <div className="flex items-center gap-2">
                        <span>Custom</span>
                      </div>
                    </SelectItem>
                    {THEME_PRESETS.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        <div className="flex items-center justify-between gap-3 w-full">
                          <span>{preset.name}</span>
                          <div className="flex gap-1 ml-auto">
                            <div
                              className="w-3 h-3 rounded-full border border-gray-200"
                              style={{ backgroundColor: preset.colors.primary }}
                            />
                            <div
                              className="w-3 h-3 rounded-full border border-gray-200"
                              style={{ backgroundColor: preset.colors.secondary }}
                            />
                            <div
                              className="w-3 h-3 rounded-full border border-gray-200"
                              style={{ backgroundColor: preset.colors.success }}
                            />
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-0.5">
                  <form.Field name="colors.primary">
                    {(field) => (
                      <ColorInput
                        label="Primary Color"
                        value={field.state.value}
                        onChange={(value) => field.handleChange(value)}
                      />
                    )}
                  </form.Field>

                  <form.Field name="colors.secondary">
                    {(field) => (
                      <ColorInput
                        label="Secondary Color"
                        value={field.state.value}
                        onChange={(value) => field.handleChange(value)}
                      />
                    )}
                  </form.Field>

                  <form.Field name="colors.background">
                    {(field) => (
                      <ColorInput
                        label="Background"
                        value={field.state.value}
                        onChange={(value) => field.handleChange(value)}
                      />
                    )}
                  </form.Field>

                  <form.Field name="colors.surface">
                    {(field) => (
                      <ColorInput
                        label="Surface (Cards/Panels)"
                        value={field.state.value}
                        onChange={(value) => field.handleChange(value)}
                      />
                    )}
                  </form.Field>

                  <form.Field name="colors.text">
                    {(field) => (
                      <ColorInput
                        label="Text Color"
                        value={field.state.value}
                        onChange={(value) => field.handleChange(value)}
                      />
                    )}
                  </form.Field>

                  <form.Field name="colors.textMuted">
                    {(field) => (
                      <ColorInput
                        label="Muted Text"
                        value={field.state.value}
                        onChange={(value) => field.handleChange(value)}
                      />
                    )}
                  </form.Field>

                  <form.Field name="colors.border">
                    {(field) => (
                      <ColorInput
                        label="Border Color"
                        value={field.state.value}
                        onChange={(value) => field.handleChange(value)}
                      />
                    )}
                  </form.Field>

                  <form.Field name="colors.link">
                    {(field) => (
                      <ColorInput
                        label="Link Color"
                        value={field.state.value}
                        onChange={(value) => field.handleChange(value)}
                      />
                    )}
                  </form.Field>

                  <form.Field name="colors.success">
                    {(field) => (
                      <ColorInput
                        label="Success Color"
                        value={field.state.value}
                        onChange={(value) => field.handleChange(value)}
                      />
                    )}
                  </form.Field>

                  <form.Field name="colors.warning">
                    {(field) => (
                      <ColorInput
                        label="Warning Color"
                        value={field.state.value}
                        onChange={(value) => field.handleChange(value)}
                      />
                    )}
                  </form.Field>

                  <form.Field name="colors.error">
                    {(field) => (
                      <ColorInput
                        label="Error Color"
                        value={field.state.value}
                        onChange={(value) => field.handleChange(value)}
                      />
                    )}
                  </form.Field>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Typography Section */}
        <Collapsible className="w-full border rounded">
          <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-medium hover:bg-muted/50">
            <span>Typography</span>
            <ChevronDown className="h-3 w-3 transition-transform duration-200 data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-2 pb-1.5 pt-1 max-h-[400px] overflow-y-auto">
            <div className="space-y-1">
                  <form.Field name="typography.fontFamily">
                    {(field) => (
                      <FontSelect
                        label="Font Family"
                        value={field.state.value}
                        onChange={(value) => field.handleChange(value)}
                      />
                    )}
                  </form.Field>

                  <form.Field name="typography.fontSize">
                    {(field) => (
                      <div className="space-y-1">
                        <Label className="text-xs">Base Font Size</Label>
                        <Select
                          value={field.state.value}
                          onValueChange={(value) => field.handleChange(value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select size..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="12px">12px (Small)</SelectItem>
                            <SelectItem value="14px">14px</SelectItem>
                            <SelectItem value="16px">16px (Default)</SelectItem>
                            <SelectItem value="18px">18px</SelectItem>
                            <SelectItem value="20px">20px</SelectItem>
                            <SelectItem value="24px">24px (Large)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </form.Field>

                  <form.Field name="typography.headingFontWeight">
                    {(field) => (
                      <div className="space-y-1">
                        <Label className="text-xs">Heading Font Weight</Label>
                        <Select
                          value={String(field.state.value)}
                          onValueChange={(value) => field.handleChange(Number(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select weight..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="100">Thin (100)</SelectItem>
                            <SelectItem value="200">Extra Light (200)</SelectItem>
                            <SelectItem value="300">Light (300)</SelectItem>
                            <SelectItem value="400">Regular (400)</SelectItem>
                            <SelectItem value="500">Medium (500)</SelectItem>
                            <SelectItem value="600">Semibold (600)</SelectItem>
                            <SelectItem value="700">Bold (700)</SelectItem>
                            <SelectItem value="800">Extra Bold (800)</SelectItem>
                            <SelectItem value="900">Black (900)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </form.Field>

                  <form.Field name="typography.headingColor">
                    {(field) => (
                      <ColorInput
                        label="Heading Color (Optional)"
                        value={field.state.value || "#1e293b"}
                        onChange={(value) => field.handleChange(value)}
                      />
                    )}
                  </form.Field>
                </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Layout Section */}
        <Collapsible className="w-full border rounded">
          <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-medium hover:bg-muted/50">
            <span>Layout</span>
            <ChevronDown className="h-3 w-3 transition-transform duration-200 data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-2 pb-1.5 pt-1 max-h-[400px] overflow-y-auto">
            <div className="space-y-1">
              <form.Field name="spacing.unit">
                {(field) => (
                  <div className="space-y-1">
                    <Label className="text-xs">Spacing Unit</Label>
                    <Input
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="0.25rem"
                      className="h-8"
                    />
                  </div>
                )}
              </form.Field>

              <form.Field name="spacing.scale">
                {(field) => (
                  <div className="space-y-1">
                    <Label className="text-xs">Spacing Scale</Label>
                    <Input
                      type="number"
                      step={0.1}
                      min={1}
                      max={3}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(Number(e.target.value))}
                      placeholder="1.5"
                      className="h-8"
                    />
                  </div>
                )}
              </form.Field>

              <form.Field name="borders.radius">
                {(field) => (
                  <div className="space-y-1">
                    <Label className="text-xs">Border Radius</Label>
                    <Input
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="0.5rem"
                      className="h-8"
                    />
                  </div>
                )}
              </form.Field>

              <form.Field name="borders.width">
                {(field) => (
                  <div className="space-y-1">
                    <Label className="text-xs">Border Width</Label>
                    <Input
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="1px"
                      className="h-8"
                    />
                  </div>
                )}
              </form.Field>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex gap-1 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={isSaving}
            size="sm"
            className="flex-1 h-6 text-xs px-2"
          >
            {mode === "page" ? "Remove" : "Reset"}
          </Button>
          <Button type="submit" disabled={isSaving} size="sm" className="flex-1 h-6 text-xs px-2">
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}

// Backward compatibility wrapper for standalone Sheet usage (e.g., app settings)
export interface ThemeEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTheme: any | undefined;
  onSave: (theme: ThemeConfigProps | undefined) => Promise<void>;
  mode: "app" | "page";
}

export function ThemeEditorSheet({
  open,
  onOpenChange,
  initialTheme,
  onSave,
  mode,
}: ThemeEditorSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {mode === "app" ? "Edit App Theme" : "Edit Page Theme"}
          </SheetTitle>
          <SheetDescription>
            {mode === "app"
              ? "Customize the default theme for all pages"
              : "Override the app theme for this page"}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <ThemeSidebarPanel
            initialTheme={initialTheme}
            onSave={async (theme) => {
              await onSave(theme);
              onOpenChange(false);
            }}
            mode={mode}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
