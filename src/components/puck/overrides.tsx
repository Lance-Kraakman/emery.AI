import { ReactNode } from "react";
import type { Overrides } from "@measured/puck";
import { ActionBar, createUsePuck } from "@measured/puck";
import { ThemeSidebarPanel } from "@/app/(app)/apps/components/ThemeEditorSheet";
import { PageSettingsPanel } from "@/app/(app)/apps/components/PageSettingsPanel";
import { PageAccessSettings } from "@/app/(app)/apps/components/PageAccessSettings";
import { Copy, Trash2 } from "lucide-react";

const usePuck = createUsePuck();

/**
 * SetDefaultTemplateAction - Action bar button for DataBlock
 * Captures the first row's content as a reusable template
 */
function SetDefaultTemplateAction() {
  const appState = usePuck((s) => s.appState);
  const dispatch = usePuck((s) => s.dispatch);
  const selectedItem = usePuck((s) => s.selectedItem);

  if (!selectedItem) return null;

  // Get the DataBlock's props
  const componentId = selectedItem.props?.id as string;
  const mode = selectedItem.props?.mode;
  const rows = selectedItem.props?._rows as Array<{ id?: number | string }> | undefined;
  const hasDefaultTemplate = !!selectedItem.props?._defaultTemplate;

  // Only show for DataBlock in list mode with rows
  if (selectedItem.type !== 'DataBlock' || mode !== 'list' || !rows?.length) {
    return null;
  }

  const handleSetDefault = () => {
    // Get first row's zone content
    const firstRowId = rows[0].id ?? 0;
    const firstZoneName = `${componentId}:item-${firstRowId}`;
    const firstZoneContent = appState.data.zones?.[firstZoneName] || [];

    if (firstZoneContent.length === 0) {
      console.log('[SetDefault] First zone is empty, nothing to save as template');
      return;
    }

    // Save as _defaultTemplate (strip IDs - will generate new ones when applied)
    const template = firstZoneContent.map((item: { type: string; props: Record<string, unknown> }) => ({
      type: item.type,
      props: { ...item.props, id: undefined },
    }));

    // Find the component in the data and update its props
    const updateComponentProps = (
      content: Array<{ type: string; props: Record<string, unknown> }>
    ): Array<{ type: string; props: Record<string, unknown> }> => {
      return content.map((item) => {
        if (item.props?.id === componentId) {
          return {
            ...item,
            props: {
              ...item.props,
              _defaultTemplate: template,
            },
          };
        }
        return item;
      });
    };

    // Update root content and all zones
    const updatedContent = updateComponentProps(appState.data.content);
    const updatedZones: Record<string, Array<{ type: string; props: Record<string, unknown> }>> = {};

    for (const [zoneName, zoneContent] of Object.entries(appState.data.zones || {})) {
      if (Array.isArray(zoneContent)) {
        updatedZones[zoneName] = updateComponentProps(zoneContent);
      }
    }

    // Apply template to all empty zones
    const finalZones = { ...updatedZones };
    rows.forEach((row, index) => {
      const rowId = row.id ?? index;
      const zoneName = `${componentId}:item-${rowId}`;
      const existingContent = finalZones[zoneName] || [];

      if (existingContent.length === 0) {
        // Apply template with new IDs
        finalZones[zoneName] = template.map((item: { type: string; props: Record<string, unknown> }) => ({
          type: item.type,
          props: {
            ...item.props,
            id: `${item.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          },
        }));
      }
    });

    dispatch({
      type: 'setData',
      data: {
        ...appState.data,
        content: updatedContent,
        zones: finalZones,
      },
    });

    console.log(`[SetDefault] Saved template with ${template.length} items, applied to empty zones`);
  };

  const handleClearDefault = () => {
    // Find the component in the data and remove _defaultTemplate
    const updateComponentProps = (
      content: Array<{ type: string; props: Record<string, unknown> }>
    ): Array<{ type: string; props: Record<string, unknown> }> => {
      return content.map((item) => {
        if (item.props?.id === componentId) {
          const { _defaultTemplate, ...restProps } = item.props;
          return {
            ...item,
            props: restProps,
          };
        }
        return item;
      });
    };

    const updatedContent = updateComponentProps(appState.data.content);
    const updatedZones: Record<string, Array<{ type: string; props: Record<string, unknown> }>> = {};

    for (const [zoneName, zoneContent] of Object.entries(appState.data.zones || {})) {
      if (Array.isArray(zoneContent)) {
        updatedZones[zoneName] = updateComponentProps(zoneContent);
      }
    }

    dispatch({
      type: 'setData',
      data: {
        ...appState.data,
        content: updatedContent,
        zones: updatedZones,
      },
    });

    console.log('[SetDefault] Cleared default template');
  };

  return (
    <>
      <ActionBar.Action onClick={handleSetDefault} label="Set as default template">
        <Copy size={16} />
      </ActionBar.Action>
      {hasDefaultTemplate && (
        <ActionBar.Action onClick={handleClearDefault} label="Clear default template">
          <Trash2 size={16} />
        </ActionBar.Action>
      )}
    </>
  );
}

/**
 * Puck UI Overrides for Transparent Theme
 *
 * Uses the official Puck overrides API to customize UI components
 * while preserving all default functionality by rendering {children}.
 *
 * Documentation: https://puckeditor.com/docs/extending-puck/ui-overrides
 */

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
    );
  },
  drawer: ({ children }) => {
    return <div className="bg-transparent">{children}</div>;
  },

  /**
   * ActionBar - Floating toolbar when a component is selected
   * Adds "Set as Default" action for DataBlock list mode
   */
  actionBar: ({ children, label }) => (
    <ActionBar label={label}>
      <ActionBar.Group>{children}</ActionBar.Group>
      <ActionBar.Group>
        <SetDefaultTemplateAction />
      </ActionBar.Group>
    </ActionBar>
  ),
});

// Backward compatibility export
export const puckUIOverrides = createPuckUIOverrides();
