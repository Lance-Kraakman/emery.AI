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
import { ChevronDown, ChevronRight, RefreshCw, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getAuditEvents, getRowHistory } from '@/app/actions/audit';
import type { AuditEvent, RowHistoryEntry } from '@/ddd/domain/audit/types';
import styles from './audit-table.module.css';

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
  { key: 'occurredAt', label: 'Time', width: '140px' },
  { key: 'actor', label: 'Actor', width: '150px' },
  { key: 'action', label: 'Action', width: '120px' },
  { key: 'resource', label: 'Resource', width: '200px' },
  { key: 'details', label: 'Details', width: 'auto' },
];

// Columns for row_history
const HISTORY_COLUMNS = [
  { key: 'changedAt', label: 'Time', width: '140px' },
  { key: 'actor', label: 'Changed By', width: '150px' },
  { key: 'operation', label: 'Operation', width: '100px' },
  { key: 'version', label: 'Version', width: '80px' },
  { key: 'changes', label: 'Changes', width: 'auto' },
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
    eventType: '',
    actorType: '',
    resourceType: '',
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

        if (filters.eventType) queryFilters.eventType = filters.eventType;
        if (filters.actorType) queryFilters.actorType = filters.actorType;
        if (filters.resourceType) queryFilters.resourceType = filters.resourceType;
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
      eventType: '',
      actorType: '',
      resourceType: '',
      after: '',
      before: '',
    });
  };

  const hasActiveFilters = Object.values(filters).some(Boolean);

  // Build class names
  const tableClasses = [
    styles.table,
    styles.striped,
    compact && styles.compact,
  ]
    .filter(Boolean)
    .join(' ');

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.tableWrapper}>
          <div className="p-4 space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>⚠️</div>
        <p className={styles.emptyText}>{error}</p>
        <Button onClick={fetchData} variant="outline" size="sm" className="mt-2">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Filters */}
      {showFilters && mode === 'audit' && (
        <div className={styles.filtersContainer}>
          <div className={styles.filtersRow}>
            <Select
              value={filters.eventType}
              onValueChange={(value) => setFilters((f) => ({ ...f, eventType: value }))}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Event Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Types</SelectItem>
                <SelectItem value="database">Database</SelectItem>
                <SelectItem value="auth">Authentication</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.actorType}
              onValueChange={(value) => setFilters((f) => ({ ...f, actorType: value }))}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Actor Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Actors</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.resourceType}
              onValueChange={(value) => setFilters((f) => ({ ...f, resourceType: value }))}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Resource Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Resources</SelectItem>
                <SelectItem value="row">Row</SelectItem>
                <SelectItem value="table">Table</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="skill">Skill</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              placeholder="After"
              value={filters.after}
              onChange={(e) => setFilters((f) => ({ ...f, after: e.target.value }))}
              className="w-[150px]"
            />

            <Input
              type="date"
              placeholder="Before"
              value={filters.before}
              onChange={(e) => setFilters((f) => ({ ...f, before: e.target.value }))}
              className="w-[150px]"
            />

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className={styles.tableWrapper}>
        {data.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📭</div>
            <p className={styles.emptyText}>
              {mode === 'history'
                ? 'No history available for this row'
                : 'No audit events found'}
            </p>
            {hasActiveFilters && (
              <Button variant="link" size="sm" onClick={clearFilters}>
                Clear filters to see all events
              </Button>
            )}
          </div>
        ) : (
          <table className={tableClasses}>
            <thead>
              <tr>
                <th className={styles.th} style={{ width: '40px' }}></th>
                {columns.map((col) => (
                  <th key={col.key} className={styles.th} style={{ width: col.width }}>
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

      {/* Count */}
      {data.length > 0 && (
        <div className={styles.footer}>
          <span className={styles.count}>
            {data.length} {data.length === 1 ? 'event' : 'events'}
          </span>
        </div>
      )}
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
      <tr className={styles.tr}>
        <td className={styles.td}>
          <button onClick={onToggle} className={styles.expandButton}>
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </td>
        <td className={styles.td}>
          {format(new Date(event.occurredAt), compact ? 'HH:mm:ss' : 'MMM d, HH:mm:ss')}
        </td>
        <td className={styles.td}>
          <div className={styles.actorCell}>
            <Badge variant={event.actorType === 'user' ? 'default' : 'secondary'}>
              {event.actorType}
            </Badge>
            {event.actorName && <span className={styles.actorName}>{event.actorName}</span>}
          </div>
        </td>
        <td className={styles.td}>
          <ActionBadge action={event.eventAction} success={event.success ?? true} />
        </td>
        <td className={styles.td}>
          <span className={styles.resourceType}>{event.resourceType}</span>
          {event.resourceName && (
            <span className={styles.resourceName}> - {event.resourceName}</span>
          )}
        </td>
        <td className={styles.td}>
          <span className={styles.eventCategory}>{event.eventCategory}</span>
          {!event.success && event.error && (
            <span className={styles.errorText}> - {event.error}</span>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className={styles.expandedRow}>
          <td colSpan={6}>
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
      <tr className={styles.tr}>
        <td className={styles.td}>
          <button onClick={onToggle} className={styles.expandButton}>
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </td>
        <td className={styles.td}>
          {format(new Date(entry.changedAt), compact ? 'HH:mm:ss' : 'MMM d, HH:mm:ss')}
        </td>
        <td className={styles.td}>
          <div className={styles.actorCell}>
            <Badge variant={entry.changedByType === 'user' ? 'default' : 'secondary'}>
              {entry.changedByType}
            </Badge>
            {entry.changedByName && <span className={styles.actorName}>{entry.changedByName}</span>}
          </div>
        </td>
        <td className={styles.td}>
          <OperationBadge operation={entry.operation} />
        </td>
        <td className={styles.td}>v{entry.version}</td>
        <td className={styles.td}>
          {entry.operation === 'UPDATE' && changeCount > 0 && (
            <span className={styles.changeCount}>
              {changeCount} field{changeCount !== 1 ? 's' : ''} changed
            </span>
          )}
          {entry.operation === 'INSERT' && <span className={styles.changeCount}>Row created</span>}
          {entry.operation === 'DELETE' && <span className={styles.changeCount}>Row deleted</span>}
        </td>
      </tr>
      {expanded && (
        <tr className={styles.expandedRow}>
          <td colSpan={6}>
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

  return <Badge variant={variant}>{action}</Badge>;
}

// Operation badge component for row history
function OperationBadge({ operation }: { operation: string }) {
  const variant =
    operation === 'INSERT'
      ? 'default'
      : operation === 'DELETE'
      ? 'destructive'
      : 'outline';

  return <Badge variant={variant}>{operation}</Badge>;
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
    <div className={styles.expandedContent}>
      {eventData && Object.keys(eventData).length > 0 && (
        <div className={styles.detailSection}>
          <h4 className={styles.detailTitle}>Event Data</h4>
          <pre className={styles.jsonBlock}>{JSON.stringify(eventData, null, 2)}</pre>
        </div>
      )}
      {previousData && Object.keys(previousData).length > 0 && (
        <div className={styles.detailSection}>
          <h4 className={styles.detailTitle}>Previous Data</h4>
          <pre className={styles.jsonBlock}>{JSON.stringify(previousData, null, 2)}</pre>
        </div>
      )}
      {metadata && Object.keys(metadata).length > 0 && (
        <div className={styles.detailSection}>
          <h4 className={styles.detailTitle}>Metadata</h4>
          <pre className={styles.jsonBlock}>{JSON.stringify(metadata, null, 2)}</pre>
        </div>
      )}
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
    <div className={styles.expandedContent}>
      {operation === 'UPDATE' && fieldChanges && (
        <div className={styles.detailSection}>
          <h4 className={styles.detailTitle}>Field Changes</h4>
          <div className={styles.changesGrid}>
            {Object.entries(fieldChanges).map(([field, change]) => (
              <div key={field} className={styles.changeRow}>
                <span className={styles.fieldName}>{field}</span>
                <span className={styles.oldValue}>
                  {formatValue(change.old)}
                </span>
                <span className={styles.arrow}>→</span>
                <span className={styles.newValue}>
                  {formatValue(change.new)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {rowSnapshot && (
        <div className={styles.detailSection}>
          <h4 className={styles.detailTitle}>
            {operation === 'DELETE' ? 'Deleted Row' : 'Row Snapshot'}
          </h4>
          <pre className={styles.jsonBlock}>{JSON.stringify(rowSnapshot, null, 2)}</pre>
        </div>
      )}
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

export default AuditTable;
