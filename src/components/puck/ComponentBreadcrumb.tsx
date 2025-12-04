"use client";

import React, { useMemo } from "react";
import { usePuck } from "@measured/puck";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  id: string;
  label: string;
  selector: { zone?: string; index: number };
}

export function ComponentBreadcrumb() {
  const { appState, selectedItem, getItemById, getSelectorForId, dispatch } = usePuck();
  const itemSelector = appState.ui.itemSelector;

  const breadcrumbs = useMemo(() => {
    if (!selectedItem || !itemSelector) return [];

    const path: BreadcrumbItem[] = [];
    const visited = new Set<string>();

    // Build path from current component up to root
    let currentId: string | undefined;
    let currentSelector = itemSelector;

    // First, we need to find the ID of the selected item
    // We'll traverse the zones to find it
    if (currentSelector.zone) {
      // Extract the parent ID from zone format "parentId:slotName"
      const colonIndex = currentSelector.zone.lastIndexOf(":");
      if (colonIndex !== -1) {
        const parentId = currentSelector.zone.substring(0, colonIndex);
        const parent = getItemById(parentId);
        
        // Get the actual selected item from parent's zone
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

    // Add root if we're not already at root
    if (!currentZone || currentZone === 'root') {
      path.push({
        id: 'root',
        label: 'Page',
        selector: { index: 0 },
      });
    }

    // Reverse to show root -> current
    return path.reverse();
  }, [selectedItem, itemSelector, getItemById, getSelectorForId]);

  if (breadcrumbs.length === 0) return null;

  // Create display path with ellipsis if needed
  const displayPath = useMemo(() => {
    if (breadcrumbs.length <= 3) {
      return breadcrumbs;
    }
    
    // Show: first > ... > parent > current
    return [
      breadcrumbs[0],
      { id: 'ellipsis', label: '...', selector: { index: -1 } },
      breadcrumbs[breadcrumbs.length - 2],
      breadcrumbs[breadcrumbs.length - 1],
    ];
  }, [breadcrumbs]);

  const handleClick = (item: BreadcrumbItem) => {
    if (item.id === 'ellipsis' || item.id === 'root') {
      // For root, clear selection
      dispatch({ type: "setUi", ui: { itemSelector: null } });
    } else {
      // Select the component
      dispatch({ type: "setUi", ui: { itemSelector: item.selector } });
    }
  };

  const fullPath = breadcrumbs.map(b => b.label).join(' > ');

  return (
    <div 
      className="px-4 py-2 border-b border-border bg-muted/30"
      title={fullPath}
    >
      <div className="flex items-center gap-1 text-xs text-muted-foreground overflow-hidden">
        {displayPath.map((item, index) => (
          <React.Fragment key={`${item.id}-${index}`}>
            {index > 0 && (
              <ChevronRight className="h-3 w-3 shrink-0" />
            )}
            {item.id === 'ellipsis' ? (
              <span className="shrink-0">...</span>
            ) : (
              <button
                onClick={() => handleClick(item)}
                className={cn(
                  "hover:text-foreground transition-colors truncate max-w-[80px]",
                  index === displayPath.length - 1 && "text-foreground font-medium"
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