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
 *
 * Template Editing UX (list mode):
 * - Default: Shows all rows as preview with corner edit button
 * - Edit mode: Shows single editable template row
 * - No template: Shows centered "Edit Template" button
 */

import { useState, useRef, useEffect, type ComponentType } from 'react';
import { registerOverlayPortal } from '@measured/puck';
import { RowDataProvider } from '@/components/puck/contexts/RowDataContext';
import { DataLayoutProvider } from '@/components/puck/contexts/DataLayoutContext';
import { useLinkContext } from '@/components/puck/link-context';
import { usePagination } from './usePagination';
import { Button } from '@/components/ui/button';
import { Section } from '@/components/puck/components/Section';
import { Pencil, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import styles from './styles.module.css';

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
  layout?: 'vertical' | 'grid' | 'horizontal';
  columns?: number;
  gap?: number;
  itemsPerPage?: number;
  paginationStyle?: 'none' | 'load-more' | 'pages';
  maxHeight?: number;
  showCarouselArrows?: boolean;

  // Server-resolved data
  _viewName?: string;
  _tableId?: number;
  _fields?: FieldDTO[];
  _rows?: Record<string, any>[];
  _resolvedRow?: Record<string, any>;
  _totalCount?: number;
  _error?: string;

  // Slot for item template - Puck passes this as a renderable component
  // Slot props: className, allow, disallow, minEmptyHeight, style, ref
  children?: ComponentType<{
    className?: string;
    allow?: string[];
    disallow?: string[];
  }>;
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
  gap = 16,
  itemsPerPage = 10,
  paginationStyle = 'none',
  maxHeight,
  showCarouselArrows = false,
  _viewName,
  _tableId,
  _fields = [],
  _rows = [],
  _resolvedRow,
  _totalCount = 0,
  _error,
  children: Children,
}: DataBlockProps) {
  // Template editing state (list mode only)
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const doneButtonRef = useRef<HTMLButtonElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Get editing context
  const { isEditing } = useLinkContext();

  // Pagination hook (only used in list mode, but called unconditionally for hook rules)
  const pagination = usePagination({
    viewId: viewId ?? 0,
    initialRows: _rows,
    totalCount: _totalCount,
    pageSize: itemsPerPage,
  });

  // Register overlay portals for interactive elements
  useEffect(() => {
    // Edit button (preview mode)
    if (editButtonRef.current && !isEditingTemplate && isEditing) {
      registerOverlayPortal(editButtonRef.current);
    }
    // Done button (edit mode)
    if (doneButtonRef.current && isEditingTemplate && isEditing) {
      registerOverlayPortal(doneButtonRef.current);
    }
    // Preview container (disables Puck overlays on preview rows)
    if (previewContainerRef.current && !isEditingTemplate && isEditing) {
      registerOverlayPortal(previewContainerRef.current);
    }
  }, [isEditingTemplate, isEditing]);

  // Debug logging
  console.log('[DataBlock] Render:', {
    mode,
    viewId,
    _tableId,
    fieldsCount: _fields.length,
    rowsCount: pagination.displayedRows.length,
    hasResolvedRow: !!_resolvedRow,
    isEditing,
    isEditingTemplate,
    paginationStyle,
    hasChildren: !!Children,
  });

  const hasTemplate = Children !== undefined;

  // Carousel scroll helper
  const scrollCarousel = (direction: 'left' | 'right') => {
    carouselRef.current?.scrollBy({
      left: direction === 'left' ? -300 : 300,
      behavior: 'smooth',
    });
  };

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
          {/* Content with row context - uses slot */}
          {wrapWithDataLayout(
            <RowDataProvider rowData={_resolvedRow} rowIndex={0}>
              <div className={styles.content}>
                {Children && <Children />}
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

  // Use rows from pagination hook
  const { displayedRows, currentPage, totalPages, isLoading, hasMore, fetchPage, loadMore } = pagination;

  // Container styles for grid/flex layout
  const containerStyle: React.CSSProperties = {
    display: layout === 'grid' ? 'grid' : 'flex',
    flexDirection: layout === 'vertical' ? 'column' : 'row',
    gridTemplateColumns: layout === 'grid' ? `repeat(${columns}, 1fr)` : undefined,
    gap: `${gap}px`,
  };

  // Scroll container style
  const scrollContainerStyle: React.CSSProperties = maxHeight
    ? { maxHeight: `${maxHeight}px`, overflowY: 'auto' }
    : {};

  // Render rows content using Children slot
  // Pass allow={[]} to disable dropping in preview rows
  const renderRows = (rows: Record<string, unknown>[], disableDrops = false) => (
    <div className={styles.repeatContainer} style={containerStyle}>
      {rows.map((row, index) => (
        <div key={(row.id as number) || index} className={styles.item}>
          <RowDataProvider rowData={row} rowIndex={index}>
            {Children && <Children allow={disableDrops ? [] : undefined} />}
          </RowDataProvider>
        </div>
      ))}
    </div>
  );

  // Render pagination controls
  const renderPaginationControls = () => {
    if (paginationStyle === 'pages' && totalPages > 1) {
      return (
        <div className={styles.pagination}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchPage(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className={styles.pageInfo}>
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchPage(currentPage + 1)}
            disabled={currentPage >= totalPages || isLoading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    if (paginationStyle === 'load-more' && hasMore) {
      return (
        <div className={styles.loadMoreContainer}>
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={isLoading}
            className={styles.loadMoreButton}
          >
            {isLoading ? 'Loading...' : `Load More (${_totalCount - displayedRows.length} remaining)`}
          </Button>
        </div>
      );
    }

    return null;
  };

  // Helper to render all rows (used in preview/public mode)
  const renderAllRows = () => (
    <Section>
      <div className={styles.dataBlock}>
        {displayedRows.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyText}>
              No data to display
              {_viewName && ` from "${_viewName}"`}
            </p>
          </div>
        ) : (
          <>
            {/* Horizontal carousel layout */}
            {layout === 'horizontal' && showCarouselArrows ? (
              <div className={styles.carouselWrapper}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => scrollCarousel('left')}
                  className={styles.carouselButton}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                {wrapWithDataLayout(
                  <div
                    ref={carouselRef}
                    className={styles.carouselScroll}
                    style={{ gap: `${gap}px` }}
                  >
                    {displayedRows.map((row, index) => (
                      <div key={(row.id as number) || index} className={styles.carouselItem}>
                        <RowDataProvider rowData={row} rowIndex={index}>
                          {Children && <Children />}
                        </RowDataProvider>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => scrollCarousel('right')}
                  className={styles.carouselButton}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              /* Standard layout with optional scroll container */
              wrapWithDataLayout(
                <div className={styles.scrollContainer} style={scrollContainerStyle}>
                  {renderRows(displayedRows)}
                </div>
              )
            )}

            {/* Pagination controls */}
            {renderPaginationControls()}
          </>
        )}
      </div>
    </Section>
  );

  // Not in editor (preview/public) - always show all rows
  if (!isEditing) {
    return renderAllRows();
  }

  // In editor, no template yet - show centered edit button
  if (!hasTemplate) {
    return (
      <Section>
        <div className="flex min-h-[200px] items-center justify-center border-2 border-dashed rounded-lg bg-muted/20">
          <Button onClick={() => setIsEditingTemplate(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Template
          </Button>
        </div>
      </Section>
    );
  }

  // In editor, editing template - show single editable row
  if (isEditingTemplate) {
    return (
      <Section>
        <div className={styles.dataBlock}>
          {wrapWithDataLayout(
            <RowDataProvider rowData={_rows[0] || {}} rowIndex={0}>
              <Children />
            </RowDataProvider>
          )}
          <div className="flex justify-center mt-4">
            <Button
              ref={doneButtonRef}
              onClick={() => setIsEditingTemplate(false)}
            >
              <Check className="mr-2 h-4 w-4" />
              Done
            </Button>
          </div>
        </div>
      </Section>
    );
  }

  // In editor, preview mode - show all rows with corner edit button
  return (
    <Section>
      <div className={styles.dataBlock}>
        <div className="relative">
          {/* Corner edit button - uses overlay portal */}
          <Button
            ref={editButtonRef}
            variant="outline"
            className="absolute top-2 right-2 z-10"
            onClick={() => setIsEditingTemplate(true)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit Template
          </Button>

          {/* Preview rows - disable drops with allow={[]} */}
          {displayedRows.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyText}>
                No data to display
                {_viewName && ` from "${_viewName}"`}
              </p>
            </div>
          ) : (
            <div ref={previewContainerRef} className={styles.previewContainer}>
              {wrapWithDataLayout(
                <div className={styles.scrollContainer} style={scrollContainerStyle}>
                  <div
                    className={cn(styles.repeatContainer, styles.previewRows)}
                    style={containerStyle}
                  >
                    {displayedRows.map((row, index) => (
                      <div key={(row.id as number) || index} className={styles.item}>
                        <RowDataProvider rowData={row} rowIndex={index}>
                          {Children && <Children allow={[]} />}
                        </RowDataProvider>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pagination controls (disabled in editor preview) */}
        {paginationStyle !== 'none' && (
          <div className={styles.paginationPreview}>
            <span className={styles.paginationPreviewText}>
              {paginationStyle === 'pages' ? 'Page navigation' : 'Load more'} (active in preview)
            </span>
          </div>
        )}
      </div>
    </Section>
  );
}
