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
  ThemeConfig,
  type ThemeConfigProps,
  DEFAULT_THEME,
} from "@/ddd/domain/puck/value-objects/theme-config";

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

  // Initialize form with current theme or default
  const currentTheme = initialTheme || DEFAULT_THEME;

  const form = useForm({
    defaultValues: currentTheme,
    onSubmit: async ({ value }) => {
      try {
        setIsSaving(true);
        await onSave(value as ThemeConfigProps);
        onOpenChange(false);
      } catch (error) {
        console.error("Error saving theme:", error);
      } finally {
        setIsSaving(false);
      }
    },
  });

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
            <TabsContent value="colors" className="space-y-4 mt-4">
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-4">
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
            <TabsContent value="typography" className="space-y-4 mt-4">
              <form.Field name="typography.fontFamily">
                {(field) => (
                  <div className="space-y-2">
                    <Label>Font Family</Label>
                    <Input
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Inter, system-ui, sans-serif"
                    />
                    <p className="text-sm text-muted-foreground">
                      CSS font stack (comma-separated)
                    </p>
                  </div>
                )}
              </form.Field>

              <form.Field name="typography.fontSize">
                {(field) => (
                  <div className="space-y-2">
                    <Label>Base Font Size</Label>
                    <Input
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="16px"
                    />
                    <p className="text-sm text-muted-foreground">
                      CSS size value (e.g., 16px, 1rem)
                    </p>
                  </div>
                )}
              </form.Field>

              <form.Field name="typography.headingFontWeight">
                {(field) => (
                  <div className="space-y-2">
                    <Label>Heading Font Weight</Label>
                    <Input
                      type="number"
                      min={100}
                      max={900}
                      step={100}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(Number(e.target.value))}
                      placeholder="600"
                    />
                    <p className="text-sm text-muted-foreground">
                      Weight from 100 (thin) to 900 (black)
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
                    <p className="text-sm text-muted-foreground">
                      Leave empty to use default text color
                    </p>
                  </div>
                )}
              </form.Field>
            </TabsContent>

            {/* Layout Tab */}
            <TabsContent value="layout" className="space-y-4 mt-4">
              <form.Field name="spacing.unit">
                {(field) => (
                  <div className="space-y-2">
                    <Label>Spacing Unit</Label>
                    <Input
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="0.25rem"
                    />
                    <p className="text-sm text-muted-foreground">
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
                    <p className="text-sm text-muted-foreground">
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
                    <p className="text-sm text-muted-foreground">
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
                    <p className="text-sm text-muted-foreground">
                      Default border thickness (e.g., 1px, 2px)
                    </p>
                  </div>
                )}
              </form.Field>
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
