'use client';

/**
 * AuditTable - Reusable audit log table component
 *
 * Displays audit events and row history in a consistent table format.
 * Can be used standalone (settings page) or embedded (DataBlock).
 *
 * Props:
 * - tableId: Filter to specific table (optional)
 * - rowId: Filter to specific row (optional)
 * - showFilters: Show filter controls (default: true)
 * - compact: Use compact styling (default: false)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight, RefreshCw, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getAuditEvents, getRowHistory } from '@/app/actions/audit';
import type { AuditEvent, RowHistoryEntry } from '@/ddd/domain/audit/types';
import { cn } from '@/lib/utils';

export interface AuditTableProps {
  // Pre-set filters (optional - for embedding in table context)
  tableId?: number;
  rowId?: string;

  // UI options
  showFilters?: boolean;
  compact?: boolean;

  // Display mode
  mode?: 'audit' | 'history'; // 'audit' = audit_events, 'history' = row_history
}

// Columns for audit_events
const AUDIT_COLUMNS = [
  { key: 'occurredAt', label: 'Time', width: 'w-[120px]' },
  { key: 'actor', label: 'Actor', width: 'w-[140px]' },
  { key: 'action', label: 'Action', width: 'w-[100px]' },
  { key: 'resource', label: 'Resource', width: 'w-[160px]' },
  { key: 'details', label: 'Details', width: 'flex-1' },
];

// Columns for row_history
const HISTORY_COLUMNS = [
  { key: 'changedAt', label: 'Time', width: 'w-[120px]' },
  { key: 'actor', label: 'Changed By', width: 'w-[140px]' },
  { key: 'operation', label: 'Operation', width: 'w-[90px]' },
  { key: 'version', label: 'Version', width: 'w-[70px]' },
  { key: 'changes', label: 'Changes', width: 'flex-1' },
];

export function AuditTable({
  tableId,
  rowId,
  showFilters = true,
  compact = false,
  mode = 'audit',
}: AuditTableProps) {
  const [data, setData] = useState<AuditEvent[] | RowHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number | bigint>>(new Set());

  // Filters state
  const [filters, setFilters] = useState({
    eventType: 'all',
    actorType: 'all',
    resourceType: 'all',
    after: '',
    before: '',
  });

  const columns = mode === 'history' ? HISTORY_COLUMNS : AUDIT_COLUMNS;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (mode === 'history' && tableId && rowId) {
        // Fetch row history
        const result = await getRowHistory(tableId, rowId);
        if (result.success && result.data) {
          setData(result.data);
        } else {
          setError(result.error || 'Failed to fetch row history');
        }
      } else {
        // Fetch audit events
        const queryFilters: Record<string, unknown> = {
          limit: 100,
        };

        if (filters.eventType && filters.eventType !== 'all') queryFilters.eventType = filters.eventType;
        if (filters.actorType && filters.actorType !== 'all') queryFilters.actorType = filters.actorType;
        if (filters.resourceType && filters.resourceType !== 'all') queryFilters.resourceType = filters.resourceType;
        if (filters.after) queryFilters.after = new Date(filters.after);
        if (filters.before) queryFilters.before = new Date(filters.before);

        // If tableId is provided, filter by parent resource
        if (tableId) {
          queryFilters.resourceType = 'row';
          // Note: We'd need to add parentResourceId filter to the query
        }

        const result = await getAuditEvents(queryFilters);
        if (result.success && result.data) {
          setData(result.data);
        } else {
          setError(result.error || 'Failed to fetch audit events');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [mode, tableId, rowId, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleRow = (id: number | bigint) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setFilters({
      eventType: 'all',
      actorType: 'all',
      resourceType: 'all',
      after: '',
      before: '',
    });
  };

  const hasActiveFilters = filters.eventType !== 'all' || filters.actorType !== 'all' ||
    filters.resourceType !== 'all' || filters.after || filters.before;

  // Filter popover content
  const FilterContent = () => (
    <div className="space-y-3 p-1">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Event Type</label>
        <Select
          value={filters.eventType}
          onValueChange={(value) => setFilters((f) => ({ ...f, eventType: value }))}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="database">Database</SelectItem>
            <SelectItem value="auth">Auth</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="agent">Agent</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Actor</label>
        <Select
          value={filters.actorType}
          onValueChange={(value) => setFilters((f) => ({ ...f, actorType: value }))}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="All Actors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actors</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="agent">Agent</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Resource</label>
        <Select
          value={filters.resourceType}
          onValueChange={(value) => setFilters((f) => ({ ...f, resourceType: value }))}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="All Resources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Resources</SelectItem>
            <SelectItem value="row">Row</SelectItem>
            <SelectItem value="table">Table</SelectItem>
            <SelectItem value="agent">Agent</SelectItem>
            <SelectItem value="skill">Skill</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">After</label>
          <Input
            type="date"
            value={filters.after}
            onChange={(e) => setFilters((f) => ({ ...f, after: e.target.value }))}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Before</label>
          <Input
            type="date"
            value={filters.before}
            onChange={(e) => setFilters((f) => ({ ...f, before: e.target.value }))}
            className="h-8 text-xs"
          />
        </div>
      </div>
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full h-8 text-xs">
          Clear filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">Audit Log</span>
          {!loading && (
            <span className="text-xs text-muted-foreground">
              {data.length} {data.length === 1 ? 'event' : 'events'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {showFilters && mode === 'audit' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 relative">
                  <Filter className="h-4 w-4" />
                  {hasActiveFilters && (
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-primary rounded-full" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="end">
                <FilterContent />
              </PopoverContent>
            </Popover>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchData} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Table container */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm mb-2">{error}</p>
            <Button onClick={fetchData} variant="outline" size="sm">
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-sm">
              {mode === 'history'
                ? 'No history available for this row'
                : 'No audit events found'}
            </p>
            {hasActiveFilters && (
              <Button variant="link" size="sm" onClick={clearFilters} className="text-xs mt-1">
                Clear filters to see all events
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background z-10">
              <tr className="border-b border-border/50">
                <th className="w-8 px-2 py-2"></th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-3 py-2 text-left text-xs font-medium text-muted-foreground",
                      col.width
                    )}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mode === 'audit'
                ? (data as AuditEvent[]).map((event) => (
                    <AuditEventRow
                      key={Number(event.id)}
                      event={event}
                      expanded={expandedRows.has(event.id)}
                      onToggle={() => toggleRow(event.id)}
                      compact={compact}
                    />
                  ))
                : (data as RowHistoryEntry[]).map((entry) => (
                    <HistoryEntryRow
                      key={Number(entry.id)}
                      entry={entry}
                      expanded={expandedRows.has(entry.id)}
                      onToggle={() => toggleRow(entry.id)}
                      compact={compact}
                    />
                  ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// Row component for audit events
function AuditEventRow({
  event,
  expanded,
  onToggle,
  compact,
}: {
  event: AuditEvent;
  expanded: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <>
      <tr className="hover:bg-muted/30 transition-colors">
        <td className="px-2 py-1.5">
          <button
            onClick={onToggle}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        </td>
        <td className="px-3 py-1.5 text-xs text-muted-foreground whitespace-nowrap">
          {format(new Date(event.occurredAt), compact ? 'HH:mm:ss' : 'MMM d, HH:mm:ss')}
        </td>
        <td className="px-3 py-1.5">
          <div className="flex items-center gap-1.5">
            <Badge variant={event.actorType === 'user' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
              {event.actorType}
            </Badge>
            {event.actorName && (
              <span className="text-xs text-muted-foreground truncate max-w-[80px]">{event.actorName}</span>
            )}
          </div>
        </td>
        <td className="px-3 py-1.5">
          <ActionBadge action={event.eventAction} success={event.success ?? true} />
        </td>
        <td className="px-3 py-1.5">
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium">{event.resourceType}</span>
              {event.resourceName && (
                <span className="text-xs text-muted-foreground truncate max-w-[100px]">- {event.resourceName}</span>
              )}
            </div>
            {/* Show parent context (e.g., table name for row operations) */}
            {event.parentResourceType && (
              <span className="text-[10px] text-muted-foreground/70">
                in {String(event.eventData?.tableName || event.parentResourceType)}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-1.5">
          <div className="flex flex-col gap-0.5">
            {/* Triggered-by context for agent actions */}
            {(() => {
              const triggeredBy = getTriggeredByContext(event);
              if (triggeredBy) {
                return (
                  <span className="text-[10px] text-blue-600 dark:text-blue-400">
                    via {triggeredBy.type}: {triggeredBy.name}
                  </span>
                );
              }
              return null;
            })()}
            {/* Smart preview of event data */}
            {(() => {
              const preview = getEventPreview(event);
              if (preview) {
                return (
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={preview}>
                    {preview}
                  </span>
                );
              }
              // Fall back to human-readable category/action description
              const readableDesc = getReadableEventDescription(event.eventCategory, event.eventAction);
              return (
                <span className="text-xs text-muted-foreground">{readableDesc}</span>
              );
            })()}
            {/* Error display */}
            {!event.success && event.error && (
              <span className="text-[10px] text-destructive truncate max-w-[200px]" title={event.error}>
                {event.error}
              </span>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="p-0">
            <ExpandedDetails
              eventData={event.eventData}
              previousData={event.previousData}
              metadata={event.metadata}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// Row component for row history
function HistoryEntryRow({
  entry,
  expanded,
  onToggle,
  compact,
}: {
  entry: RowHistoryEntry;
  expanded: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  const changeCount = entry.fieldChanges ? Object.keys(entry.fieldChanges).length : 0;

  return (
    <>
      <tr className="hover:bg-muted/30 transition-colors">
        <td className="px-2 py-1.5">
          <button
            onClick={onToggle}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        </td>
        <td className="px-3 py-1.5 text-xs text-muted-foreground whitespace-nowrap">
          {format(new Date(entry.changedAt), compact ? 'HH:mm:ss' : 'MMM d, HH:mm:ss')}
        </td>
        <td className="px-3 py-1.5">
          <div className="flex items-center gap-1.5">
            <Badge variant={entry.changedByType === 'user' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
              {entry.changedByType}
            </Badge>
            {entry.changedByName && (
              <span className="text-xs text-muted-foreground truncate max-w-[80px]">{entry.changedByName}</span>
            )}
          </div>
        </td>
        <td className="px-3 py-1.5">
          <OperationBadge operation={entry.operation} />
        </td>
        <td className="px-3 py-1.5 text-xs text-muted-foreground">v{entry.version}</td>
        <td className="px-3 py-1.5 text-xs text-muted-foreground">
          {entry.operation === 'UPDATE' && changeCount > 0 && (
            <span>{changeCount} field{changeCount !== 1 ? 's' : ''} changed</span>
          )}
          {entry.operation === 'INSERT' && <span>Row created</span>}
          {entry.operation === 'DELETE' && <span>Row deleted</span>}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="p-0">
            <FieldChangesDetail
              operation={entry.operation}
              fieldChanges={entry.fieldChanges}
              rowSnapshot={entry.rowSnapshot}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// Action badge component
function ActionBadge({ action, success }: { action: string; success: boolean }) {
  const variant = success
    ? action === 'create'
      ? 'default'
      : action === 'delete'
      ? 'destructive'
      : 'outline'
    : 'destructive';

  return <Badge variant={variant} className="text-[10px] px-1.5 py-0">{action}</Badge>;
}

// Operation badge component for row history
function OperationBadge({ operation }: { operation: string }) {
  const variant =
    operation === 'INSERT'
      ? 'default'
      : operation === 'DELETE'
      ? 'destructive'
      : 'outline';

  return <Badge variant={variant} className="text-[10px] px-1.5 py-0">{operation}</Badge>;
}

// Expanded details component
function ExpandedDetails({
  eventData,
  previousData,
  metadata,
}: {
  eventData?: Record<string, unknown>;
  previousData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) {
  return (
    <div className="px-4 py-3 bg-muted/30 border-t border-dashed border-border">
      <div className="grid gap-3">
        {eventData && Object.keys(eventData).length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Event Data</div>
            <pre className="text-[11px] font-mono bg-background border border-border rounded p-2 max-h-[100px] overflow-auto">
              {JSON.stringify(eventData, null, 2)}
            </pre>
          </div>
        )}
        {previousData && Object.keys(previousData).length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Previous Data</div>
            <pre className="text-[11px] font-mono bg-background border border-border rounded p-2 max-h-[100px] overflow-auto">
              {JSON.stringify(previousData, null, 2)}
            </pre>
          </div>
        )}
        {metadata && Object.keys(metadata).length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Metadata</div>
            <pre className="text-[11px] font-mono bg-background border border-border rounded p-2 max-h-[100px] overflow-auto">
              {JSON.stringify(metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// Field changes detail component for row history
function FieldChangesDetail({
  operation,
  fieldChanges,
  rowSnapshot,
}: {
  operation: string;
  fieldChanges?: Record<string, { old: unknown; new: unknown }>;
  rowSnapshot?: Record<string, unknown>;
}) {
  return (
    <div className="px-4 py-3 bg-muted/30 border-t border-dashed border-border">
      <div className="grid gap-3">
        {operation === 'UPDATE' && fieldChanges && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Field Changes</div>
            <div className="space-y-1">
              {Object.entries(fieldChanges).map(([field, change]) => (
                <div key={field} className="flex items-center gap-2 text-xs bg-background border border-border rounded px-2 py-1">
                  <span className="font-medium min-w-[80px]">{field}</span>
                  <span className="text-destructive bg-destructive/10 px-1.5 py-0.5 rounded font-mono text-[10px] truncate max-w-[150px]">
                    {formatValue(change.old)}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-green-600 dark:text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded font-mono text-[10px] truncate max-w-[150px]">
                    {formatValue(change.new)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {rowSnapshot && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">
              {operation === 'DELETE' ? 'Deleted Row' : 'Row Snapshot'}
            </div>
            <pre className="text-[11px] font-mono bg-background border border-border rounded p-2 max-h-[100px] overflow-auto">
              {JSON.stringify(rowSnapshot, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper to format values for display
function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value || '(empty)';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// Human-readable labels for event categories
const EVENT_CATEGORY_LABELS: Record<string, string> = {
  // Database operations
  row_crud: 'Row operation',
  table_crud: 'Table operation',
  field_crud: 'Field operation',
  // Agent/Skill operations
  skill_crud: 'Skill operation',
  agent_crud: 'Agent operation',
  definition: 'Definition change',
  task_execution: 'Task execution',
  // Auth
  auth_login: 'User login',
  auth_logout: 'User logout',
  auth_register: 'User registration',
  // Billing
  subscription: 'Subscription',
  payment: 'Payment',
  // App
  webhook: 'Webhook',
  integration: 'Integration',
};

// Get human-readable description for an event
function getReadableEventDescription(category: string, action: string): string {
  // Build action-specific descriptions
  const actionLabels: Record<string, string> = {
    create: 'Created',
    update: 'Updated',
    delete: 'Deleted',
    execute: 'Executed',
    read: 'Viewed',
  };

  const resourceLabels: Record<string, string> = {
    row_crud: 'row',
    table_crud: 'table',
    field_crud: 'field',
    skill_crud: 'skill',
    agent_crud: 'agent',
    definition: 'definition',
    task_execution: 'task',
  };

  // Try to build "Action + Resource" format
  const actionLabel = actionLabels[action];
  const resourceLabel = resourceLabels[category];
  if (actionLabel && resourceLabel) {
    return `${actionLabel} ${resourceLabel}`;
  }

  // Fall back to category label
  if (EVENT_CATEGORY_LABELS[category]) {
    return EVENT_CATEGORY_LABELS[category];
  }

  // Last resort: humanize the category string
  return category
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Helper to generate smart preview from event data
function getEventPreview(event: AuditEvent): string | null {
  const { eventAction, eventData, previousData } = event;

  // For updates with previous data, show what changed
  if (eventAction === 'update' && previousData && eventData) {
    const changedFields: string[] = [];
    for (const key of Object.keys(eventData)) {
      if (key !== 'tableName' && key !== 'tableId' && previousData[key] !== undefined) {
        const oldVal = formatValue(previousData[key]);
        const newVal = formatValue(eventData[key]);
        if (oldVal !== newVal) {
          changedFields.push(`${key}: ${oldVal} → ${newVal}`);
        }
      }
    }
    if (changedFields.length > 0) {
      return changedFields.length <= 2
        ? changedFields.join(', ')
        : `${changedFields[0]} (+${changedFields.length - 1} more)`;
    }
  }

  // For creates, show field count or key fields
  if (eventAction === 'create' && eventData) {
    const dataKeys = Object.keys(eventData).filter(k => !['tableName', 'tableId', 'rowId'].includes(k));
    if (dataKeys.length > 0) {
      return `Created with ${dataKeys.length} field${dataKeys.length !== 1 ? 's' : ''}`;
    }
  }

  // For deletes, indicate what was removed
  if (eventAction === 'delete') {
    return 'Permanently removed';
  }

  // For executions, show duration if available
  if (eventAction === 'execute' && event.durationMs) {
    return `Completed in ${event.durationMs}ms`;
  }

  return null;
}

// Helper to extract triggered-by context from metadata/eventData
function getTriggeredByContext(event: AuditEvent): { type: string; name: string } | null {
  const { actorType, metadata, eventData } = event;

  // Only relevant for agent actions
  if (actorType !== 'agent') return null;

  // Check metadata for task/user context
  if (metadata) {
    if (metadata.triggeredByUser && metadata.triggeredByUserName) {
      return { type: 'user', name: String(metadata.triggeredByUserName) };
    }
    if (metadata.taskId && metadata.taskName) {
      return { type: 'task', name: String(metadata.taskName) };
    }
    if (metadata.triggeredBy) {
      return { type: 'request', name: String(metadata.triggeredBy) };
    }
  }

  // Check eventData as fallback
  if (eventData) {
    if (eventData.requestedByUser) {
      return { type: 'user', name: String(eventData.requestedByUser) };
    }
    if (eventData.taskName) {
      return { type: 'task', name: String(eventData.taskName) };
    }
  }

  return null;
}

export default AuditTable;
