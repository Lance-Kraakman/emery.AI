'use client';

/**
 * DataBlock - Client Component
 *
 * Unified data block that replaces DataContextBlock and RepeatBlock.
 * Supports two modes:
 * - single: Provides single-record context to children (detail pages)
 * - list: Repeats children for each row (list/grid layouts)
 *
 * Uses DataLayoutContext to share field metadata with child field blocks.
 * Uses RowDataContext to provide row data to children.
 */

import { DropZone } from "@measured/puck";
import { RowDataProvider } from '@/components/puck/contexts/RowDataContext';
import { DataLayoutProvider } from '@/components/puck/contexts/DataLayoutContext';
import { Button } from '@/components/ui/button';
import { Section } from '@/components/puck/components/Section';
import { cn } from '@/lib/utils';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import styles from './styles.module.css';

/** Template item structure stored in _defaultTemplate */
export interface TemplateItem {
  type: string;
  props: Record<string, unknown>;
}

export interface DataBlockProps {
  // Puck component ID (used for zone naming)
  id?: string;

  // Mode
  mode: 'single' | 'list';

  // View selection
  viewId?: number;

  // Single mode options
  rowSelectionMode?: 'param' | 'static';
  rowParam?: string;
  rowId?: number;

  // List mode options
  layout?: 'vertical' | 'grid';
  columns?: number;
  gap?: string;
  itemsPerPage?: number;
  showLoadMore?: boolean;

  // Server-resolved data
  _viewName?: string;
  _tableId?: number;
  _fields?: FieldDTO[];
  _rows?: Record<string, any>[];
  _resolvedRow?: Record<string, any>;
  _totalCount?: number;
  _error?: string;

  // Default template for list items (set via action bar)
  // Using 'any' to bypass Puck's SlotComponent inference
  _defaultTemplate?: any;

  // Puck props
  puck?: {
    renderDropZone: typeof DropZone;
  };
}

export default function DataBlock({
  id,
  mode = 'single',
  viewId,
  rowSelectionMode = 'param',
  rowParam = 'id',
  rowId,
  layout = 'vertical',
  columns = 2,
  gap = '4',
  itemsPerPage = 10,
  showLoadMore = true,
  _viewName,
  _tableId,
  _fields = [],
  _rows = [],
  _resolvedRow,
  _totalCount = 0,
  _error,
  puck,
}: DataBlockProps) {
  // Debug logging
  console.log('[DataBlock] Render:', {
    mode,
    viewId,
    _tableId,
    fieldsCount: _fields.length,
    rowsCount: _rows.length,
    hasResolvedRow: !!_resolvedRow,
  });

  const hasMoreItems = _totalCount > _rows.length;

  // No view selected - show placeholder
  if (!viewId) {
    return (
      <Section>
        <div className={styles.placeholder}>
          <p className={styles.placeholderText}>
            Please select a data source (view) in the editor
          </p>
        </div>
      </Section>
    );
  }

  // Error loading data
  if (_error) {
    return (
      <Section>
        <div className={styles.error}>
          <p className={styles.errorText}>Error loading data: {_error}</p>
        </div>
      </Section>
    );
  }

  // Wrap content with DataLayoutProvider for field selector support
  const wrapWithDataLayout = (children: React.ReactNode) => (
    <DataLayoutProvider tableId={_tableId} viewId={viewId} fields={_fields}>
      {children}
    </DataLayoutProvider>
  );

  // ============================================
  // SINGLE MODE: Show one record
  // ============================================
  if (mode === 'single') {
    // Validation for single mode
    if (rowSelectionMode === 'param' && !rowParam) {
      return (
        <Section>
          <div className={styles.error}>
            <p className={styles.errorText}>
              Please specify which query parameter contains the row ID
            </p>
          </div>
        </Section>
      );
    }

    if (rowSelectionMode === 'static' && !rowId) {
      return (
        <Section>
          <div className={styles.error}>
            <p className={styles.errorText}>Please specify a row ID</p>
          </div>
        </Section>
      );
    }

    // No data loaded
    if (!_resolvedRow) {
      return (
        <Section>
          <div className={styles.empty}>
            <p className={styles.emptyText}>
              No data found
              {rowSelectionMode === 'param' && rowParam && ` (query param "${rowParam}" not provided or row not found)`}
            </p>
          </div>
        </Section>
      );
    }

    return (
      <Section>
        <div className={styles.dataBlock}>
          {/* Header */}
          {_viewName && (
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <span className={styles.badge}>Data</span>
                <span className={styles.viewName}>{_viewName}</span>
              </div>
            </div>
          )}

          {/* Content with row context */}
          {wrapWithDataLayout(
            <RowDataProvider rowData={_resolvedRow} rowIndex={0}>
              <div className={styles.content}>
                {puck?.renderDropZone ? (
                  <DropZone zone="content" />
                ) : (
                  <div className={styles.templatePlaceholder}>
                    <p className={styles.templatePlaceholderText}>
                      Drag blocks here to display data from this record
                    </p>
                    <p className={styles.hint}>
                      Use Field blocks (TextField, ImageField, etc.) to display specific fields
                    </p>
                  </div>
                )}
              </div>
            </RowDataProvider>
          )}
        </div>
      </Section>
    );
  }

  // ============================================
  // LIST MODE: Repeat for each row
  // ============================================

  // No rows - show empty state
  if (_rows.length === 0) {
    return (
      <Section>
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            No data to display
            {_viewName && ` from "${_viewName}"`}
          </p>
        </div>
      </Section>
    );
  }

  // Determine container classes based on layout
  const containerClass = cn(
    styles.repeatContainer,
    layout === 'vertical' ? styles.vertical : styles.horizontal,
    layout === 'grid' && `grid-cols-${columns}`,
    `gap-${gap}`
  );

  return (
    <Section>
      <div className={styles.dataBlock}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.badge}>Data List</span>
            {_viewName && <span className={styles.viewName}>{_viewName}</span>}
          </div>
          <div className={styles.headerRight}>
            <span className={styles.count}>
              {_rows.length} {_rows.length === 1 ? 'item' : 'items'}
              {hasMoreItems && ` of ${_totalCount}`}
            </span>
          </div>
        </div>

        {/* Repeat items container - unique zone per row */}
        {wrapWithDataLayout(
          <div className={containerClass}>
            {_rows.map((row, index) => (
              <div key={row.id || index} className={styles.item}>
                <RowDataProvider rowData={row} rowIndex={index}>
                  {puck?.renderDropZone ? (
                    <DropZone zone={`item-${row.id || index}`} />
                  ) : (
                    <div className={styles.templatePlaceholder}>
                      <p className={styles.templatePlaceholderText}>
                        Drag blocks here to design your item template
                      </p>
                    </div>
                  )}
                </RowDataProvider>
              </div>
            ))}
          </div>
        )}

        {/* Load more button */}
        {showLoadMore && hasMoreItems && (
          <div className={styles.loadMoreContainer}>
            <Button
              variant="outline"
              onClick={() => {
                // TODO: Implement pagination
                console.log('Load more clicked');
              }}
              className={styles.loadMoreButton}
            >
              Load More ({_totalCount - _rows.length} remaining)
            </Button>
          </div>
        )}
      </div>
    </Section>
  );
}
