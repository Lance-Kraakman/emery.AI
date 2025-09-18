'use client'

import React, { useState, useMemo } from 'react';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Badge } from '@/src/components/ui/badge';
import { Search, SlidersHorizontal, Grid, List } from 'lucide-react';
import { AppConnectionCard, type AppInfo } from './AppConnectionCard';
import { ConnectionDTO as Connection } from '@/src/app/mappers/connection-mapper';

interface UnifiedConnectionsGridProps {
  apps: AppInfo[];
  connections: Connection[];
  allConnections?: Connection[];
  showAllDuplicates?: boolean;
  duplicateCount?: number;
  connectingApp?: string | null;
  disconnectingAccount?: string | null;
  onConnect: (appId: string) => void;
  onDisconnect: (connectionId: string) => void;
  onReconnect?: (appId: string) => void;
  onToggleDuplicates?: () => void;
}

type FilterType = 'all' | 'connected' | 'available' | 'error';
type SortType = 'name' | 'status' | 'recent';
type ViewType = 'grid' | 'list';

export function UnifiedConnectionsGrid({
  apps,
  connections,
  allConnections,
  showAllDuplicates = false,
  duplicateCount = 0,
  connectingApp,
  disconnectingAccount,
  onConnect,
  onDisconnect,
  onReconnect,
  onToggleDuplicates
}: UnifiedConnectionsGridProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortType>('name');
  const [viewType, setViewType] = useState<ViewType>('grid');

  // Use the appropriate connections list based on duplicate toggle
  const activeConnections = showAllDuplicates && allConnections ? allConnections : connections;

  // Create unified app data with connection status
  const unifiedApps = useMemo(() => {
    return apps.map(app => {
      // Find connection for this app (use first match for display)
      const connection = activeConnections.find(c => c.app === app.id);

      return {
        app,
        connection,
        status: !connection
          ? 'available'
          : (connection.status === 'connected' || connection.status === 'active')
            ? 'connected'
            : connection.status === 'error'
              ? 'error'
              : 'unknown'
      };
    });
  }, [apps, activeConnections]);

  // Filter and sort apps
  const filteredAndSortedApps = useMemo(() => {
    let filtered = unifiedApps;

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(({ app, connection }) =>
        app.name.toLowerCase().includes(searchLower) ||
        app.description.toLowerCase().includes(searchLower) ||
        (connection?.account_name?.toLowerCase().includes(searchLower))
      );
    }

    // Apply status filter
    if (filter !== 'all') {
      filtered = filtered.filter(({ status }) => status === filter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sort) {
        case 'name':
          return a.app.name.localeCompare(b.app.name);
        case 'status':
          const statusOrder = { connected: 0, error: 1, available: 2, unknown: 3 };
          return statusOrder[a.status as keyof typeof statusOrder] - statusOrder[b.status as keyof typeof statusOrder];
        case 'recent':
          // For now, sort by connection status, could be enhanced with actual timestamps
          return a.status === 'connected' ? -1 : b.status === 'connected' ? 1 : 0;
        default:
          return 0;
      }
    });

    return filtered;
  }, [unifiedApps, searchTerm, filter, sort]);

  // Get filter counts for badges
  const filterCounts = useMemo(() => {
    const counts = unifiedApps.reduce((acc, { status }) => {
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      all: unifiedApps.length,
      connected: counts.connected || 0,
      available: counts.available || 0,
      error: counts.error || 0
    };
  }, [unifiedApps]);

  return (
    <div className="space-y-6">
      {/* Header with Search and Controls */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">App Connections</h2>
            <p className="text-sm text-muted-foreground">
              Manage apps that your agents can use on your behalf
              {duplicateCount > 0 && (
                <span className="ml-2 text-amber-600 font-medium">
                  ({duplicateCount} duplicates {showAllDuplicates ? 'shown' : 'hidden'})
                </span>
              )}
            </p>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={viewType === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewType('grid')}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewType === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewType('list')}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Duplicate Management Banner */}
        {duplicateCount > 0 && onToggleDuplicates && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-amber-800 font-medium">
                  {duplicateCount} duplicate connection{duplicateCount !== 1 ? 's' : ''} found
                </div>
                <div className="text-amber-700 text-sm">
                  {showAllDuplicates
                    ? `Showing all connections including duplicates`
                    : `Duplicates are hidden for clarity`
                  }
                </div>
              </div>
              <Button
                onClick={onToggleDuplicates}
                variant="outline"
                size="sm"
                className="text-amber-800 border-amber-300 hover:bg-amber-100"
              >
                {showAllDuplicates ? 'Hide Duplicates' : 'Show All'}
              </Button>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Search apps..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />

            {/* Status Filter */}
            <Select value={filter} onValueChange={(value: FilterType) => setFilter(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  All ({filterCounts.all})
                </SelectItem>
                <SelectItem value="connected">
                  Connected ({filterCounts.connected})
                </SelectItem>
                <SelectItem value="available">
                  Available ({filterCounts.available})
                </SelectItem>
                {filterCounts.error > 0 && (
                  <SelectItem value="error">
                    Error ({filterCounts.error})
                  </SelectItem>
                )}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sort} onValueChange={(value: SortType) => setSort(value)}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="recent">Recent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Filter Summary */}
        {(searchTerm || filter !== 'all') && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              Showing {filteredAndSortedApps.length} of {unifiedApps.length} apps
            </span>
            {searchTerm && (
              <Badge variant="outline" className="text-xs">
                Search: "{searchTerm}"
              </Badge>
            )}
            {filter !== 'all' && (
              <Badge variant="outline" className="text-xs">
                Filter: {filter}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setFilter('all');
              }}
              className="h-6 px-2 text-xs"
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Apps Grid/List */}
      {filteredAndSortedApps.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-muted-foreground">
            {searchTerm || filter !== 'all'
              ? 'No apps match your search criteria'
              : 'No apps available'
            }
          </div>
          {(searchTerm || filter !== 'all') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setFilter('all');
              }}
              className="mt-2"
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className={
          viewType === 'grid'
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
            : 'grid grid-cols-1 gap-3'
        }>
          {filteredAndSortedApps.map(({ app, connection }) => (
            <AppConnectionCard
              key={app.id}
              app={app}
              connection={connection}
              isConnecting={connectingApp === app.id}
              isDisconnecting={connection ? disconnectingAccount === connection.id : false}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
              onReconnect={onReconnect}
              className={viewType === 'list' ? 'max-w-none' : ''}
            />
          ))}
        </div>
      )}
    </div>
  );
}