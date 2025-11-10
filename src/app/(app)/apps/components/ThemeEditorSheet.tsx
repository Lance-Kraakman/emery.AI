/**
 * ThemeEditorSheet - Reusable Theme Configuration UI
 *
 * AIDEV-NOTE: Used in both app settings and Puck editor header.
 * Provides tabbed interface for editing theme configuration (colors, typography, layout).
 * Supports both app-level themes and page-level overrides.
 */

"use client";

import * as React from "react";
import { useForm } from "@tanstack/react-form";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

export interface ThemeEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTheme: any | undefined; // ThemeConfigProps from DTO
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
  const [isSaving, setIsSaving] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("colors");
  const [selectedPreset, setSelectedPreset] = React.useState<string>("custom");

  // Initialize form with current theme or default
  const currentTheme = initialTheme || DEFAULT_THEME;

  const form = useForm({
    defaultValues: currentTheme,
    onSubmit: async ({ value }) => {
      try {
        setIsSaving(true);
        await onSave(value as ThemeConfigProps);
        form.reset();
        onOpenChange(false);
      } catch (error) {
        console.error("Error saving theme:", error);
      } finally {
        setIsSaving(false);
      }
    },
  });

  // Reset form when sheet closes
  React.useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

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
      onOpenChange(false);
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {mode === "app" ? "Edit App Theme" : "Edit Page Theme"}
          </SheetTitle>
          <SheetDescription>
            {mode === "app"
              ? "Customize the default theme for all pages in this app"
              : "Override the app theme for this specific page"}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="mt-6"
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="colors">Colors</TabsTrigger>
              <TabsTrigger value="typography">Typography</TabsTrigger>
              <TabsTrigger value="layout">Layout</TabsTrigger>
            </TabsList>

            {/* Colors Tab */}
            <TabsContent value="colors" className="space-y-3 mt-4">
              {/* Preset Selector */}
              <div className="space-y-2">
                <Label>Color Palette</Label>
                <Select value={selectedPreset} onValueChange={handlePresetChange}>
                  <SelectTrigger>
                    <div className="flex items-center gap-2 w-full">
                      <span className="flex-1 text-left">
                        {selectedPreset === "custom"
                          ? "Custom"
                          : THEME_PRESETS.find((p) => p.id === selectedPreset)?.name}
                      </span>
                      {selectedPreset !== "custom" && (
                        <div className="flex gap-1">
                          {(() => {
                            const preset = THEME_PRESETS.find((p) => p.id === selectedPreset);
                            return preset ? (
                              <>
                                <div
                                  className="w-4 h-4 rounded-full border border-gray-200"
                                  style={{ backgroundColor: preset.colors.primary }}
                                  title="Primary"
                                />
                                <div
                                  className="w-4 h-4 rounded-full border border-gray-200"
                                  style={{ backgroundColor: preset.colors.secondary }}
                                  title="Secondary"
                                />
                                <div
                                  className="w-4 h-4 rounded-full border border-gray-200"
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
                <p className="text-xs text-muted-foreground">
                  {selectedPreset === "custom"
                    ? "Using custom colors"
                    : THEME_PRESETS.find((p) => p.id === selectedPreset)?.description}
                </p>
              </div>

              <ScrollArea className="h-[calc(100vh-420px)] max-h-[500px] pr-4">
                <div className="space-y-3">
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
              </ScrollArea>
            </TabsContent>

            {/* Typography Tab */}
            <TabsContent value="typography" className="space-y-3 mt-4">
              <ScrollArea className="h-[calc(100vh-320px)] max-h-[600px] pr-4">
                <div className="space-y-3">
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
                      <div className="space-y-2">
                        <Label>Base Font Size</Label>
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
                        <p className="text-xs text-muted-foreground">
                          Base font size for body text
                        </p>
                      </div>
                    )}
                  </form.Field>

                  <form.Field name="typography.headingFontWeight">
                    {(field) => (
                      <div className="space-y-2">
                        <Label>Heading Font Weight</Label>
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
                        <p className="text-xs text-muted-foreground">
                          Font weight for headings
                        </p>
                      </div>
                    )}
                  </form.Field>

                  <form.Field name="typography.headingColor">
                    {(field) => (
                      <div className="space-y-2">
                        <ColorInput
                          label="Heading Color (Optional)"
                          value={field.state.value || "#1e293b"}
                          onChange={(value) => field.handleChange(value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Leave empty to use default text color
                        </p>
                      </div>
                    )}
                  </form.Field>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Layout Tab */}
            <TabsContent value="layout" className="space-y-3 mt-4">
              <ScrollArea className="h-[calc(100vh-320px)] max-h-[600px] pr-4">
                <div className="space-y-3">
              <form.Field name="spacing.unit">
                {(field) => (
                  <div className="space-y-2">
                    <Label>Spacing Unit</Label>
                    <Input
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="0.25rem"
                    />
                    <p className="text-xs text-muted-foreground">
                      Base unit for spacing calculations
                    </p>
                  </div>
                )}
              </form.Field>

              <form.Field name="spacing.scale">
                {(field) => (
                  <div className="space-y-2">
                    <Label>Spacing Scale</Label>
                    <Input
                      type="number"
                      step={0.1}
                      min={1}
                      max={3}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(Number(e.target.value))}
                      placeholder="1.5"
                    />
                    <p className="text-xs text-muted-foreground">
                      Multiplier for spacing progression (1.0 - 3.0)
                    </p>
                  </div>
                )}
              </form.Field>

              <form.Field name="borders.radius">
                {(field) => (
                  <div className="space-y-2">
                    <Label>Border Radius</Label>
                    <Input
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="0.5rem"
                    />
                    <p className="text-xs text-muted-foreground">
                      Roundness of corners (e.g., 0.5rem, 8px)
                    </p>
                  </div>
                )}
              </form.Field>

              <form.Field name="borders.width">
                {(field) => (
                  <div className="space-y-2">
                    <Label>Border Width</Label>
                    <Input
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="1px"
                    />
                    <p className="text-xs text-muted-foreground">
                      Default border thickness (e.g., 1px, 2px)
                    </p>
                  </div>
                )}
              </form.Field>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <SheetFooter className="mt-6 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={isSaving}
            >
              {mode === "page" ? "Remove Override" : "Reset to Default"}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
