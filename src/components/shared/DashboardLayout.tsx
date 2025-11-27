'use client';

import { ReactNode, useState } from 'react';
import { Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Loading } from '@/components/ui/loading';

// AIDEV-NOTE: Generic dashboard layout to reduce duplication across dashboard components
// Provides consistent left panel (list) + right panel (details) layout

interface DashboardLayoutProps<T = any> {
  // Left Panel Props
  items: T[];
  selectedItem: T | null;
  onSelectItem: (item: T | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  loading?: boolean;
  error?: string | null;
  
  // Action Props
  onAddNew?: () => void;
  addNewLabel?: string;
  addNewIcon?: ReactNode;
  
  // Filter Props (optional)
  filterComponent?: ReactNode;
  
  // Empty State Props
  emptyTitle?: string;
  emptyDescription?: string;
  
  // Render Props
  renderListItem: (item: T) => ReactNode;
  renderDetails: () => ReactNode;
  
  // Layout Props
  leftPanelTitle?: string;
  leftPanelWidth?: string;
  rightPanelCollapsible?: boolean;
  
  // Panel State
  isPanelCollapsed?: boolean;
  onPanelToggle?: () => void;
}

export function DashboardLayout<T extends { id: any }>({
  items,
  selectedItem,
  onSelectItem,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search...',
  loading = false,
  error,
  onAddNew,
  addNewLabel = 'Add New',
  addNewIcon = <Plus className="h-4 w-4" />,
  filterComponent,
  emptyTitle = 'No items found',
  emptyDescription = 'Create your first item to get started.',
  renderListItem,
  renderDetails,
  leftPanelTitle,
  leftPanelWidth = 'w-80',
  rightPanelCollapsible = true,
  isPanelCollapsed = false,
  onPanelToggle,
}: DashboardLayoutProps<T>) {
  
  const hasRightPanel = selectedItem !== null;
  
  return (
    <div className="flex h-full overflow-y-auto">
      {/* Left Pane: Item List */}
      <div className={`${leftPanelWidth} ${hasRightPanel && !isPanelCollapsed ? 'border-r border-border' : ''} bg-card flex flex-col`}>
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            {leftPanelTitle && (
              <h2 className="text-lg font-semibold text-foreground flex-1">
                {leftPanelTitle}
              </h2>
            )}
            {onAddNew && (
              <Button 
                onClick={onAddNew}
                size="sm"
                variant="outline"
                className="flex items-center gap-1 text-xs"
              >
                {addNewIcon}
                {addNewLabel}
              </Button>
            )}
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>
          
          {/* Optional Filter Component */}
          {filterComponent && (
            <div className="mt-3">
              {filterComponent}
            </div>
          )}
        </div>
        
        {/* Items List */}
        <div className="flex-1 overflow-hidden">
          {error ? (
            <div className="p-4">
              <div className="text-sm text-destructive">
                {error}
              </div>
            </div>
          ) : loading ? (
            <div className="p-4">
              <Loading text="Loading..." />
            </div>
          ) : items.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={emptyTitle}
                description={emptyDescription}
                action={onAddNew ? {
                  label: addNewLabel,
                  onClick: onAddNew
                } : undefined}
              />
            </div>
          ) : (
            <div className="p-4 space-y-2 overflow-y-auto">
              {items.map(item => (
                <div
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className={`cursor-pointer transition-colors ${
                    selectedItem?.id === item.id
                      ? 'ring-2 ring-primary ring-offset-2'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  {renderListItem(item)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Right Pane: Details or Editor */}
      {hasRightPanel && !isPanelCollapsed && (
        <div className="flex-1 bg-background">
          {renderDetails()}
          
          {/* Panel Toggle Button */}
          {rightPanelCollapsible && onPanelToggle && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onPanelToggle}
              className="absolute top-4 right-4 h-8 w-8 bg-background border shadow-sm"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
      
      {/* Collapsed Panel Expand Button */}
      {hasRightPanel && isPanelCollapsed && rightPanelCollapsible && onPanelToggle && (
        <div className="w-12 bg-background border-l border-border flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPanelToggle}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {/* No Selection State */}
      {!hasRightPanel && (
        <div className="flex-1 bg-background flex items-center justify-center">
          <EmptyState
            title="Select an item"
            description="Choose an item from the list to view details."
          />
        </div>
      )}
    </div>
  );
}