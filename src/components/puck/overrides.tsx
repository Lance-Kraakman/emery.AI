import type { Overrides } from "@measured/puck";
import { ThemeSidebarPanel } from "@/app/(app)/apps/components/ThemeEditorSheet";
import { PageSettingsPanel } from "@/app/(app)/apps/components/PageSettingsPanel";
import { PageAccessSettings } from "@/app/(app)/apps/components/PageAccessSettings";
import { VariableAutocompleteInput } from "./fields/VariableAutocompleteInput";
import { RowDataProvider } from "./contexts/RowDataContext";
import { DataLayoutProvider } from "./contexts/DataLayoutContext";
import { useTemplateEditor } from "./contexts/TemplateEditorContext";
import { useDataBlockContextForSelection } from "./hooks/useDataBlockContextForSelection";

/**
 * Puck UI Overrides for Transparent Theme
 *
 * Uses the official Puck overrides API to customize UI components
 * while preserving all default functionality by rendering {children}.
 *
 * Documentation: https://puckeditor.com/docs/extending-puck/ui-overrides
 */

/**
 * IframeWithTemplateContext - Wrapper component for iframe content
 *
 * This is a separate component because React hooks (useTemplateEditor)
 * cannot be called inside the inline function of overrides.
 *
 * Wraps iframe content with RowDataProvider when editing a DataBlock template.
 * Note: DataLayoutProvider is provided at the parent level (inside TemplateEditorProvider)
 * so that sidebar components can access field metadata.
 */
function IframeWithTemplateContext({ children }: { children: React.ReactNode }) {
  const templateEditor = useTemplateEditor();

  // When editing a DataBlock template with fields, wrap with RowDataProvider for canvas preview
  if (templateEditor.isActive && templateEditor.fields.length > 0) {
    return (
      <RowDataProvider
        rowData={templateEditor.sampleRow}
        rowIndex={0}
        fields={templateEditor.fields}
      >
        {children}
      </RowDataProvider>
    );
  }

  // Default: render children without wrapper
  return <>{children}</>;
}

/**
 * FieldsWithDataBlockContext - Wrapper for sidebar fields
 *
 * When a component inside a DataBlock slot is selected, wraps the sidebar
 * with DataLayoutProvider so that VariableAutocompleteInput can access
 * the parent DataBlock's field metadata.
 */
function FieldsWithDataBlockContext({ children }: { children: React.ReactNode }) {
  const dataBlockContext = useDataBlockContextForSelection();

  // If selection is inside a DataBlock, provide its context to sidebar
  if (dataBlockContext) {
    return (
      <DataLayoutProvider
        tableId={dataBlockContext.tableId}
        viewId={dataBlockContext.viewId}
        fields={dataBlockContext.fields}
        sampleRow={dataBlockContext.sampleRow}
      >
        {children}
      </DataLayoutProvider>
    );
  }

  // Default: render children without wrapper
  return <>{children}</>;
}

interface PuckUIOverridesOptions {
  pageId?: number;
  pageName?: string;
  pageSlug?: string;
  pageIsPublic?: boolean;
  pageRequiresAuth?: boolean;
  pageAllowedRoles?: string[];
  onSavePageSettings?: (data: { name: string; slug: string }) => Promise<void>;
  onSaveAccessSettings?: (data: { requiresAuth: boolean; allowedRoles: string[] }) => Promise<void>;
  themeMode?: "app" | "page";
  /**
   * When true, applies template-mode styling to the preview.
   * Centers content and adds padding for better template editing UX.
   */
  isTemplateMode?: boolean;
}

export const createPuckUIOverrides = (
  options?: PuckUIOverridesOptions
): Partial<Overrides> => ({
  /**
   * Fields - Right sidebar containing page settings, theme panel, and component properties
   */
  fields: ({ children, isLoading, itemSelector }) => {
    const isRootLevel = !itemSelector;

    return (
      <FieldsWithDataBlockContext>
        <div className="bg-transparent">
          {isLoading && (
            <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50">
              <div className="text-sm text-muted-foreground">Loading...</div>
            </div>
          )}
          {/* Page Settings Panel */}
          {isRootLevel && options?.onSavePageSettings && options?.pageId !== undefined && (
            <div className="border-b border-border">
              <PageSettingsPanel
                pageId={options.pageId}
                initialName={options.pageName || ""}
                initialSlug={options.pageSlug || "/"}
                onSave={options.onSavePageSettings}
              />
            </div>
          )}
          {/* Page Access Settings Panel */}
          {isRootLevel && options?.onSaveAccessSettings && options?.pageId !== undefined && (
            <div className="border-b border-border">
              <PageAccessSettings
                pageId={options.pageId}
                isPublic={options.pageIsPublic || false}
                initialRequiresAuth={options.pageRequiresAuth || false}
                initialAllowedRoles={options.pageAllowedRoles || []}
                onSave={options.onSaveAccessSettings}
              />
            </div>
          )}
          {/* Theme Panel - uses context for all operations */}
          {isRootLevel && options?.themeMode && (
            <div className="border-b border-border">
              <ThemeSidebarPanel mode={options.themeMode} />
            </div>
          )}
          {children}
        </div>
      </FieldsWithDataBlockContext>
    );
  },
  drawer: ({ children }) => {
    return <div className="bg-transparent">{children}</div>;
  },

  /**
   * Field Type Overrides - Replace default text inputs with variable-aware inputs
   *
   * All text and textarea fields now support variable interpolation:
   * - {{state.varName}} - Page state variables (auto-populated from URL params)
   * - {{rowData.fieldName}} - Parent DataBlock row fields
   */
  fieldTypes: {
    text: ({ value, onChange, field, readOnly }) => (
      <VariableAutocompleteInput
        value={value || ''}
        onChange={onChange}
        placeholder={(field as any)?.placeholder}
        disabled={readOnly}
      />
    ),
    textarea: ({ value, onChange, field, readOnly }) => (
      <VariableAutocompleteInput
        value={value || ''}
        onChange={onChange}
        placeholder={(field as any)?.placeholder}
        multiline
        rows={4}
        disabled={readOnly}
      />
    ),
  },

  /**
   * Iframe Override - Wrap iframe content with RowDataProvider
   *
   * When editing a DataBlock template, wraps the preview with:
   * - RowDataProvider: Provides sample row data for canvas preview
   *
   * Note: DataLayoutProvider is at the parent level (inside TemplateEditorProvider)
   * so sidebar components can access field metadata outside the iframe.
   *
   * Uses TemplateEditorContext (provided by TemplateEditorProvider in page.tsx)
   * to get fresh fields and sample row data.
   */
  iframe: ({ children }) => {
    // Use TemplateEditorContext to get fields and sample row
    // This is safe because useTemplateEditor returns defaults when not in provider
    return <IframeWithTemplateContext>{children}</IframeWithTemplateContext>;
  },

  /**
   * Preview Override - Custom container for template mode
   *
   * When editing a DataBlock template, wraps the preview with a centered container
   * that provides proper padding and sizing for template content.
   */
  preview: options?.isTemplateMode
    ? ({ children }) => (
        <div className="template-preview-wrapper">
          {children}
        </div>
      )
    : undefined,
});

// Backward compatibility export
export const puckUIOverrides = createPuckUIOverrides();
