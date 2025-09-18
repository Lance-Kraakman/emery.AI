'use client';

import React, { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import { ScrollArea } from '@/src/components/ui/scroll-area';
import { Loading } from '@/src/components/ui/loading';
import { EmptyState } from '@/src/components/ui/empty-state';
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  XCircle, 
  ChevronLeft,
  Plus
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

// AIDEV-NOTE: Generic activity panel to reduce duplication across activity components
// Supports different item types and provides consistent layout

interface ActivityItem {
  id: string;
  type: string;
  status?: string;
  title: string;
  description?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface GenericActivityPanelProps<T = ActivityItem> {
  title?: string;
  items: T[];
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  emptyDescription?: string;
  onCollapse?: () => void;
  onAddNew?: () => void;
  addNewLabel?: string;
  selectedItems?: string[];
  onClearSelection?: () => void;
  renderItem?: (item: T) => ReactNode;
  showFilters?: boolean;
  filterComponent?: ReactNode;
}

const getStatusIcon = (status?: string) => {
  switch (status) {
    case 'in_progress':
    case 'running':
    case 'active':
      return <Activity className="w-4 h-4 text-green-600" />;
    case 'pending':
    case 'waiting':
      return <Clock className="w-4 h-4 text-yellow-600" />;
    case 'completed':
    case 'success':
    case 'finished':
      return <CheckCircle className="w-4 h-4 text-blue-600" />;
    case 'failed':
    case 'error':
      return <XCircle className="w-4 h-4 text-red-600" />;
    default:
      return <Clock className="w-4 h-4 text-gray-600" />;
  }
};

const getStatusColor = (status?: string) => {
  switch (status) {
    case 'in_progress':
    case 'running':
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'pending':
    case 'waiting':
      return 'bg-yellow-100 text-yellow-800';
    case 'completed':
    case 'success':
    case 'finished':
      return 'bg-blue-100 text-blue-800';
    case 'failed':
    case 'error':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export function GenericActivityPanel<T extends ActivityItem>({
  title = 'Activity',
  items,
  loading = false,
  error,
  emptyMessage = 'No activity yet',
  emptyDescription = 'Activity will appear here when available.',
  onCollapse,
  onAddNew,
  addNewLabel = 'Add New',
  selectedItems = [],
  onClearSelection,
  renderItem,
  showFilters = false,
  filterComponent,
}: GenericActivityPanelProps<T>) {

  const defaultRenderItem = (item: T) => (
    <Card key={item.id} className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 mt-0.5">
              {getStatusIcon(item.status)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-medium text-sm truncate">
                  {item.title}
                </h4>
                {item.status && (
                  <Badge className={`text-xs px-2 py-0.5 ${getStatusColor(item.status)}`}>
                    {item.status}
                  </Badge>
                )}
              </div>
              
              {item.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {item.description}
                </p>
              )}
              
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <span>{formatDistanceToNow(item.timestamp, { addSuffix: true })}</span>
                {item.type && (
                  <>
                    <span>•</span>
                    <span className="capitalize">{item.type.replace('_', ' ')}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-sm">
            {title}
            {onCollapse && (
              <Button variant="ghost" size="icon" onClick={onCollapse}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {title}
            {selectedItems.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {selectedItems.length} selected
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {selectedItems.length > 0 && onClearSelection && (
              <Button variant="ghost" size="sm" onClick={onClearSelection}>
                Clear
              </Button>
            )}
            {onAddNew && (
              <Button variant="ghost" size="icon" onClick={onAddNew}>
                <Plus className="h-4 w-4" />
              </Button>
            )}
            {onCollapse && (
              <Button variant="ghost" size="icon" onClick={onCollapse}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardTitle>
        
        {showFilters && filterComponent && (
          <div className="pt-2">
            {filterComponent}
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <Loading text="Loading activity..." />
        ) : items.length === 0 ? (
          <EmptyState 
            title={emptyMessage}
            description={emptyDescription}
            action={onAddNew ? {
              label: addNewLabel,
              onClick: onAddNew
            } : undefined}
          />
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-2">
              {items.map(item => 
                renderItem ? renderItem(item) : defaultRenderItem(item)
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}