"use client";

import React, { useMemo } from "react";
import { usePuck } from "@measured/puck";
import { ChevronRight, FileText, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EditingContextItem } from "@/components/puck/types/editing-context";

interface BreadcrumbItem {
  id: string;
  label: string;
  selector: { zone?: string; index: number };
}

interface ComponentBreadcrumbProps {
  editingStack?: EditingContextItem[];
  onNavigate?: (level: number) => void;
}

function getContextIcon(item: EditingContextItem) {
  switch (item.type) {
    case 'page': return <FileText className="h-3 w-3" />;
    case 'dialog': return <MessageSquare className="h-3 w-3" />;
    default: return <FileText className="h-3 w-3" />;
  }
}

function getContextLabel(item: EditingContextItem): string {
  switch (item.type) {
    case 'page': return 'Page';
    case 'dialog': return item.dialogName || 'Dialog';
    default: return 'Page';
  }
}

export function ComponentBreadcrumb({ editingStack, onNavigate }: ComponentBreadcrumbProps) {
  const { appState, selectedItem, getItemById, getSelectorForId, dispatch } = usePuck();
  const itemSelector = appState.ui.itemSelector;

  // Build Puck component hierarchy breadcrumbs
  const componentBreadcrumbs = useMemo(() => {
    const path: BreadcrumbItem[] = [];

    // If nothing is selected, no component breadcrumbs
    if (!selectedItem || !itemSelector) {
      return [];
    }

    // Early return if no content
    if (!appState.data?.content || appState.data.content.length === 0) {
      return [];
    }

    const visited = new Set<string>();

    // Find the ID of the selected item
    let currentId: string | undefined;
    let currentSelector = itemSelector;

    if (currentSelector.zone) {
      const colonIndex = currentSelector.zone.lastIndexOf(":");
      if (colonIndex !== -1) {
        const parentId = currentSelector.zone.substring(0, colonIndex);
        const parent = getItemById(parentId);

        if (parent && parent.props && typeof parent.props === 'object') {
          const slotName = currentSelector.zone.substring(colonIndex + 1);
          const slot = parent.props[slotName];
          if (Array.isArray(slot) && slot[currentSelector.index]) {
            currentId = slot[currentSelector.index].props?.id;
          }
        }
      }
    }

    // Add the current component
    if (selectedItem) {
      path.push({
        id: currentId || 'current',
        label: selectedItem.type,
        selector: itemSelector,
      });
    }

    // Traverse up the tree
    let currentZone = itemSelector.zone;
    while (currentZone && !visited.has(currentZone)) {
      visited.add(currentZone);

      const colonIndex = currentZone.indexOf(":");
      if (colonIndex === -1) break;

      const parentId = currentZone.substring(0, colonIndex);
      const parent = getItemById(parentId);

      if (parent) {
        try {
          const parentSelector = getSelectorForId(parentId);
          path.push({
            id: parentId,
            label: parent.type,
            selector: parentSelector || { index: 0 },
          });
          currentZone = parentSelector?.zone;
        } catch {
          break;
        }
      } else {
        break;
      }
    }

    // Reverse to show root -> current
    return path.reverse();
  }, [selectedItem, itemSelector, getItemById, getSelectorForId, appState.data?.content]);

  // Create display path with ellipsis if needed for component hierarchy
  const displayComponentPath = useMemo(() => {
    if (componentBreadcrumbs.length <= 2) {
      return componentBreadcrumbs;
    }

    // Show: first > ... > current
    // Store the second-to-last item's selector in ellipsis for navigation
    const prevComponent = componentBreadcrumbs[componentBreadcrumbs.length - 2];
    return [
      componentBreadcrumbs[0],
      { id: 'ellipsis', label: '...', selector: prevComponent.selector },
      componentBreadcrumbs[componentBreadcrumbs.length - 1],
    ];
  }, [componentBreadcrumbs]);

  const handleComponentClick = (item: BreadcrumbItem) => {
    // Ellipsis navigates to the previous level (selector stored when ellipsis was created)
    dispatch({ type: "setUi", ui: { itemSelector: item.selector } });
  };

  const handleContextClick = (index: number) => {
    // Clear component selection when navigating editing context
    dispatch({ type: "setUi", ui: { itemSelector: null } });
    onNavigate?.(index);
  };

  // Determine if we're at the last level (current editing context)
  const isLastContextLevel = (index: number) => {
    return editingStack && index === editingStack.length - 1;
  };

  return (
    <div className="px-4 py-2 border-b border-border bg-muted/30">
      <div className="flex items-center gap-1 text-xs text-muted-foreground overflow-hidden">
        {/* Editing context breadcrumbs */}
        {editingStack?.map((item, index) => (
          <React.Fragment key={`ctx-${index}`}>
            {index > 0 && (
              <ChevronRight className="h-3 w-3 shrink-0" />
            )}
            <button
              onClick={() => handleContextClick(index)}
              disabled={isLastContextLevel(index) && displayComponentPath.length === 0}
              className={cn(
                "flex items-center gap-1 hover:text-foreground transition-colors truncate max-w-[100px]",
                isLastContextLevel(index) && displayComponentPath.length === 0 && "text-foreground font-medium cursor-default"
              )}
            >
              {getContextIcon(item)}
              <span>{getContextLabel(item)}</span>
            </button>
          </React.Fragment>
        ))}

        {/* Component hierarchy breadcrumbs */}
        {displayComponentPath.map((item, index) => (
          <React.Fragment key={`comp-${item.id}-${index}`}>
            <ChevronRight className="h-3 w-3 shrink-0" />
            {item.id === 'ellipsis' ? (
              <button
                onClick={() => handleComponentClick(item)}
                className="shrink-0 hover:text-foreground transition-colors"
              >
                ...
              </button>
            ) : (
              <button
                onClick={() => handleComponentClick(item)}
                className={cn(
                  "hover:text-foreground transition-colors truncate max-w-[80px]",
                  index === displayComponentPath.length - 1 && "text-foreground font-medium"
                )}
              >
                {item.label}
              </button>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
