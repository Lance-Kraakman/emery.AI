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
 * Uses EditableRowContext to provide edit mode capabilities.
 *
 * Template Editing:
 * - Template content is stored as Puck Data in templateContent prop
 * - Click "Edit Template" to open dedicated editor (like dialog editing)
 * - Uses ConditionalBlock-style floating bar for edit/preview toggle
 *
 * Data Edit Mode:
 * - When editEnabled=true, field blocks can render as inputs
 * - Save is always manual (requires save button)
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Render, registerOverlayPortal, type Data } from '@measured/puck';
import { config } from '@/components/puck/config';
import { RowDataProvider } from '@/components/puck/contexts/RowDataContext';
import { DataLayoutProvider } from '@/components/puck/contexts/DataLayoutContext';
import { EditableRowProvider } from '@/components/puck/contexts/EditableRowContext';
import { useLinkContext } from '@/components/puck/contexts/PageContext';
import { useEditingStack } from '@/components/puck/contexts/EditingStackContext';
import { usePagination } from './usePagination';
import { useChildDataBlock } from './useChildDataBlock';
import { updateRowData, createRow } from '@/app/actions/rows';
import { Button } from '@/components/ui/button';
import { Section } from '@/components/puck/components/Section';
import { Database, Pencil, Eye, ChevronLeft, ChevronRight, Save, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { RowFilterConfig } from '../../fields/MultiFilterField';
import type { RowSortConfig } from '../../fields/MultiSortField';
import { CreateRowDialog } from './CreateRowDialog';
import styles from './styles.module.css';

/** Simplified edit state for a row */
interface RowEditState {
  isEditMode: boolean;
  isSaving: boolean;
}

/** Initial edit state */
const initialEditState: RowEditState = {
  isEditMode: false,
  isSaving: false,
};

export interface DataBlockProps {
  // Mode
  mode: 'single' | 'list';

  // View selection
  viewId?: number;

  // Row filter configuration (for both single and list modes)
  rowFilter?: RowFilterConfig;

  // Row sort configuration (for list mode)
  sortConfig?: RowSortConfig;

  // List mode options
  layout?: 'vertical' | 'grid' | 'horizontal';
  columns?: number;
  gap?: string;
  itemsPerPage?: number;
  paginationStyle?: 'none' | 'load-more' | 'pages';
  maxHeight?: number;
  showCarouselArrows?: boolean;

  // Edit mode options
  editEnabled?: boolean;
  allowCreate?: boolean;

  // Server-resolved data
  _viewName?: string;
  _tableId?: number;
  _fields?: FieldDTO[];
  _rows?: Record<string, unknown>[];
  _resolvedRow?: Record<string, unknown>;
  _totalCount?: number;
  _error?: string;

  // Template content stored as Puck Data (like dialog content)
  templateContent?: Data;

  // Puck component ID (for edit template dispatch)
  id?: string;
}

export default function DataBlock({
  mode = 'single',
  viewId,
  rowFilter,
  sortConfig,
  layout = 'vertical',
  columns = 2,
  gap = "4",
  itemsPerPage = 10,
  paginationStyle = 'none',
  maxHeight,
  showCarouselArrows = false,
  editEnabled = false,
  allowCreate = false,
  _viewName,
  _tableId,
  _fields = [],
  _rows = [],
  _resolvedRow,
  _totalCount = 0,
  _error,
  templateContent,
  id: componentId,
}: DataBlockProps) {
  // Editor view mode (edit = single template, preview = all rows)
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('preview');
  const barRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Get editing context (Puck editor vs preview/public)
  const { isEditing } = useLinkContext();
  const { pushDataBlock } = useEditingStack();

  // NOTE: We do NOT use usePuck() here because this component renders on public/preview pages
  // where there's no <Puck> wrapper. The pushDataBlock from EditingStackContext is wrapped by
  // PuckEditorLayout to inject appState.data when in editor mode.

  // ============================================
  // CLIENT-SIDE DATA FETCHING (for rowData variables)
  // ============================================
  // When filter contains {rowData.x} variables, we need to fetch data client-side
  // because the parent row data is only available at render time
  const childData = useChildDataBlock({
    viewId,
    filterConfig: rowFilter,
    sortConfig,
    pageSize: itemsPerPage,
    mode,
  });

  // ============================================
  // EDIT MODE STATE (simplified - form-based)
  // ============================================

  // Single mode: edit state
  const [singleEditState, setSingleEditState] = useState<RowEditState>(initialEditState);

  // List mode: per-row edit states (keyed by row ID)
  const [rowEditStates, setRowEditStates] = useState<Map<string, RowEditState>>(new Map());

  // Creating new row state
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Helper: Convert form data (field names as keys) to row data format (field IDs as keys)
  const convertFieldNamesToIds = (data: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    for (const [fieldName, value] of Object.entries(data)) {
      const field = _fields.find(f => f.name === fieldName);
      if (field) {
        result[String(field.id)] = value;
      }
    }
    return result;
  };
  const [newRowErrors, setNewRowErrors] = useState<Record<string, string>>({});
  const [isCreatingSaving, setIsCreatingSaving] = useState(false);

  // ============================================
  // LOCAL ROW DATA (for optimistic UI updates)
  // ============================================

  // Single mode: local copy of row data
  const [localRowData, setLocalRowData] = useState(_resolvedRow);

  // List mode: local copy of rows
  const [localRows, setLocalRows] = useState(_rows);

  // Sync local state when server props change (e.g., navigation)
  useEffect(() => {
    setLocalRowData(_resolvedRow);
  }, [_resolvedRow]);

  useEffect(() => {
    setLocalRows(_rows);
  }, [_rows]);

  // When using client-side fetching, sync from childData
  useEffect(() => {
    if (childData.needsClientFetch && !childData.loading) {
      if (mode === 'single' && childData.resolvedRow) {
        setLocalRowData(childData.resolvedRow);
      } else if (mode === 'list' && childData.rows.length > 0) {
        setLocalRows(childData.rows);
      }
    }
  }, [childData.needsClientFetch, childData.loading, childData.resolvedRow, childData.rows, mode]);

  // Get edit state for a specific row (list mode)
  const getRowEditState = useCallback((rowId: string): RowEditState => {
    return rowEditStates.get(rowId) || initialEditState;
  }, [rowEditStates]);

  // Set edit state for a specific row (list mode)
  const setRowEditState = useCallback((rowId: string, update: Partial<RowEditState>) => {
    setRowEditStates(prev => {
      const newMap = new Map(prev);
      const currentState = prev.get(rowId) || initialEditState;
      newMap.set(rowId, { ...currentState, ...update });
      return newMap;
    });
  }, []);

  // ============================================
  // EDIT MODE HANDLERS (simplified)
  // ============================================

  // Cancel editing (single mode)
  const handleCancelSingle = useCallback(() => {
    setSingleEditState(initialEditState);
  }, []);

  // Toggle edit mode (single mode)
  const handleSetEditModeSingle = useCallback((enabled: boolean) => {
    setSingleEditState({ isEditMode: enabled, isSaving: false });
  }, []);

  // ============================================
  // LIST MODE EDIT HANDLERS (simplified)
  // ============================================

  // Cancel editing for a row
  const createCancelForRow = useCallback((rowId: string) => {
    return () => setRowEditState(rowId, initialEditState);
  }, [setRowEditState]);

  // Toggle edit mode for a row
  const createSetEditModeForRow = useCallback((rowId: string) => {
    return (enabled: boolean) => setRowEditState(rowId, { isEditMode: enabled, isSaving: false });
  }, [setRowEditState]);

  // ============================================
  // CREATE NEW ROW HANDLERS
  // ============================================

  const handleCreateNewRow = useCallback(() => {
    setIsCreatingNew(true);
    setNewRowErrors({});
  }, []);

  const handleCancelCreate = useCallback(() => {
    setIsCreatingNew(false);
    setNewRowErrors({});
  }, []);

  const handleSaveNewRow = useCallback(async (data: Record<number, unknown>) => {
    if (!_tableId) return;

    setIsCreatingSaving(true);

    try {
      // Convert field IDs to names
      const dataToCreate: Record<string, unknown> = {};
      for (const [fieldIdStr, value] of Object.entries(data)) {
        const fieldId = parseInt(fieldIdStr, 10);
        const field = _fields.find(f => f.id === fieldId);
        if (field) {
          dataToCreate[field.name] = value;
        }
      }

      const result = await createRow({
        tableId: _tableId,
        data: dataToCreate,
      });

      if (result.success) {
        setIsCreatingNew(false);
        setNewRowErrors({});
        // Data will refresh on next page load
      } else {
        setNewRowErrors({ _form: result.error || 'Failed to create row' });
      }
    } catch (error) {
      setNewRowErrors({
        _form: error instanceof Error ? error.message : 'Failed to create row',
      });
    } finally {
      setIsCreatingSaving(false);
    }
  }, [_tableId, _fields]);

  // Pagination hook (only used in list mode, but called unconditionally for hook rules)
  const pagination = usePagination({
    viewId: viewId ?? 0,
    initialRows: _rows,
    totalCount: _totalCount,
    pageSize: itemsPerPage,
  });

  // Register floating bar as overlay portal so buttons remain clickable
  useEffect(() => {
    if (barRef.current && isEditing) {
      registerOverlayPortal(barRef.current);
    }
  }, [isEditing]);

  const hasTemplate = templateContent && templateContent.content && templateContent.content.length > 0;

  // Carousel scroll helper
  const scrollCarousel = (direction: 'left' | 'right') => {
    carouselRef.current?.scrollBy({
      left: direction === 'left' ? -300 : 300,
      behavior: 'smooth',
    });
  };

  // Handle edit template action - push onto editing stack via context
  const handleEditTemplate = () => {
    // Validate required IDs before pushing
    if (!viewId || !_tableId) {
      console.warn('[DataBlock] Cannot edit template: viewId or tableId missing');
      return;
    }

    const template = templateContent || { content: [], root: { props: {} }, zones: {} };
    // TemplateEditorContext will fetch fields and sample row fresh
    // pushDataBlock is wrapped by PuckEditorLayout to inject appState.data
    pushDataBlock(componentId || '', _viewName || 'DataBlock', template, viewId, _tableId);
  };

  // Render template content using Puck Render
  const renderTemplateContent = () => {
    if (!templateContent || !templateContent.content || templateContent.content.length === 0) {
      return (
        <div className="text-muted-foreground text-sm py-4 text-center border-2 border-dashed rounded-md">
          No template content
        </div>
      );
    }
    return <Render config={config} data={templateContent} />;
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

  // Error loading data (server-side or client-side)
  if (_error || childData.error) {
    return (
      <Section>
        <div className={styles.error}>
          <p className={styles.errorText}>Error loading data: {_error || childData.error}</p>
        </div>
      </Section>
    );
  }

  // Loading state for client-side fetching (when using rowData variables)
  if (childData.needsClientFetch && childData.loading) {
    return (
      <Section>
        <div className={styles.empty}>
          <p className={styles.emptyText}>Loading...</p>
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
    // Check for valid filter configuration
    const hasValidFilter = rowFilter?.conditions?.some(c => c.field && c.value);

    // No filter configured - show help message
    if (!hasValidFilter) {
      return (
        <Section>
          <div className={styles.empty}>
            <p className={styles.emptyText}>
              Configure a filter to select a row (e.g., id equals {'{params.id}'})
            </p>
          </div>
        </Section>
      );
    }

    // No data loaded - could be editor mode where variable isn't available
    if (!_resolvedRow && !isEditing) {
      // Build a description of the filter for the message
      const filterDesc = rowFilter?.conditions
        ?.filter(c => c.field && c.value)
        .map(c => `${c.field} ${c.operator || 'equals'} ${c.value}`)
        .join(` ${rowFilter.logic?.toUpperCase() || 'AND'} `) || 'unknown';

      return (
        <Section>
          <div className={styles.empty}>
            <p className={styles.emptyText}>
              No data found for filter: {filterDesc}
            </p>
          </div>
        </Section>
      );
    }

    const rowId = _resolvedRow ? String(_resolvedRow.id) : '';

    // Form submit handler for single mode
    const handleSingleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
      console.log('[DataBlock] handleSingleFormSubmit called');
      e.preventDefault();

      console.log('[DataBlock] _tableId:', _tableId, 'rowId:', rowId);
      if (!_tableId) {
        console.log('[DataBlock] Early return - no tableId');
        return;
      }

      setSingleEditState(prev => ({ ...prev, isSaving: true }));

      try {
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData);
        console.log('[DataBlock] Form data collected:', data);
        console.log('[DataBlock] Form data keys:', Object.keys(data));

        console.log('[DataBlock] Calling updateRowData...');
        const result = await updateRowData({
          tableId: _tableId,
          rowId,
          data,
        });
        console.log('[DataBlock] updateRowData result:', result);

        if (result.success) {
          console.log('[DataBlock] Save successful, updating local state');
          // Use server response for complete row data (includes auto-fields like created_at)
          if (result.data) {
            const serverRowData: Record<string, unknown> = { id: result.data.id };
            for (const fv of result.data.fieldValues) {
              serverRowData[fv.fieldId] = fv.value;
            }
            setLocalRowData(serverRowData);
          }
          setSingleEditState(initialEditState);
        } else {
          console.error('[DataBlock] Save failed:', result.error);
          setSingleEditState(prev => ({ ...prev, isSaving: false }));
        }
      } catch (error) {
        console.error('[DataBlock] Save error:', error);
        setSingleEditState(prev => ({ ...prev, isSaving: false }));
      }
    };

    // Render single record with optional edit mode
    // Use localRowData for optimistic updates (falls back to _resolvedRow)
    const displayRow = localRowData ?? _resolvedRow;

    // Helper to render single mode content
    const renderSingleModeContent = () => {
      // In editor with no data, show placeholder
      if (!displayRow) {
        return (
          <div className="text-muted-foreground text-sm py-4 text-center border-2 border-dashed rounded-md">
            No data available - filter will be applied at runtime
          </div>
        );
      }

      return wrapWithDataLayout(
        <RowDataProvider rowData={displayRow} rowIndex={0} fields={_fields}>
            {editEnabled && singleEditState.isEditMode ? (
              <EditableRowProvider
                isEditMode={singleEditState.isEditMode}
                isSaving={singleEditState.isSaving}
                tableId={_tableId ?? null}
                rowId={rowId}
                cancel={handleCancelSingle}
                setEditMode={handleSetEditModeSingle}
              >
                <form onSubmit={handleSingleFormSubmit}>
                  <div className={styles.content}>
                    {renderTemplateContent()}
                  </div>
                  {!isEditing && (
                    <div className={styles.editControls}>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={singleEditState.isSaving}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        {singleEditState.isSaving ? 'Saving...' : 'Save'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelSingle}
                        disabled={singleEditState.isSaving}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  )}
                </form>
              </EditableRowProvider>
            ) : editEnabled ? (
              <EditableRowProvider
                isEditMode={false}
                isSaving={false}
                tableId={_tableId ?? null}
                rowId={rowId}
                cancel={handleCancelSingle}
                setEditMode={handleSetEditModeSingle}
              >
                <div className={styles.content}>
                  {renderTemplateContent()}
                </div>
                {!isEditing && (
                  <div className={styles.editControls}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSetEditModeSingle(true)}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                )}
              </EditableRowProvider>
            ) : (
              <div className={styles.content}>
                {renderTemplateContent()}
              </div>
            )}
        </RowDataProvider>
      );
    };

    // Not in editor (preview/public) - show content directly
    if (!isEditing) {
      return (
        <Section>
          <div className={styles.dataBlock}>
            {renderSingleModeContent()}
          </div>
        </Section>
      );
    }

    // ============================================
    // EDITOR MODE for SINGLE: Show floating bar
    // ============================================
    return (
      <Section>
        <div className="relative border-2 border-dashed border-purple-300 rounded-lg p-3 min-h-[60px]">
          {/* ConditionalBlock-style floating bar at top */}
          <div
            ref={barRef}
            className="absolute -top-3 left-2 bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full flex items-center gap-1.5 font-mono z-50"
          >
            <Database className="h-3 w-3" />
            <span className="max-w-[120px] truncate">{_viewName || 'DataBlock'}</span>
            <span className="text-purple-500">(single)</span>

            {/* Divider */}
            <div className="w-px h-3 bg-purple-300 mx-1" />

            {/* Edit Template button */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleEditTemplate(); }}
              className="px-1.5 py-0.5 rounded hover:bg-purple-200 transition-colors"
            >
              Edit Template
            </button>
          </div>

          {/* Content area */}
          <div className="mt-2">
            {!hasTemplate ? (
              <div className="text-muted-foreground text-sm py-4 text-center border-2 border-dashed rounded-md">
                No template content - click "Edit Template" to add components
              </div>
            ) : (
              renderSingleModeContent()
            )}
          </div>
        </div>
      </Section>
    );
  }

  // ============================================
  // LIST MODE: Repeat for each row
  // ============================================

  // Use rows from pagination hook
  const { displayedRows, currentPage, totalPages, isLoading, hasMore, fetchPage, loadMore } = pagination;

  // Merge local updates into displayed rows for optimistic UI
  // For each displayed row, use the local version if it exists (was edited)
  const mergedDisplayedRows = displayedRows.map(row => {
    const localRow = localRows.find(r => r.id === row.id);
    return localRow ?? row;
  });

  // Container styles for grid/flex layout
  const containerStyle: React.CSSProperties = {
    display: layout === 'grid' ? 'grid' : 'flex',
    flexDirection: layout === 'vertical' ? 'column' : 'row',
    gridTemplateColumns: layout === 'grid' ? `repeat(${columns}, 1fr)` : undefined,
    gap: `var(--spacing-${gap}, 16px)`,
  };

  // Scroll container style
  const scrollContainerStyle: React.CSSProperties = maxHeight
    ? { maxHeight: `${maxHeight}px`, overflowY: 'auto' }
    : {};

  // Form submit handler for list mode rows
  const handleRowFormSubmit = async (
    e: React.FormEvent<HTMLFormElement>,
    rowId: string
  ) => {
    console.log('[DataBlock] handleRowFormSubmit called for row:', rowId);
    e.preventDefault();

    console.log('[DataBlock] _tableId:', _tableId);
    if (!_tableId) {
      console.log('[DataBlock] Early return - no tableId');
      return;
    }

    setRowEditState(rowId, { isSaving: true });

    try {
      const formData = new FormData(e.currentTarget);
      const data = Object.fromEntries(formData);
      console.log('[DataBlock] Form data collected:', data);

      console.log('[DataBlock] Calling updateRowData...');
      const result = await updateRowData({
        tableId: _tableId,
        rowId,
        data,
      });
      console.log('[DataBlock] updateRowData result:', result);

      if (result.success) {
        console.log('[DataBlock] Save successful, updating local state');
        // Use server response for complete row data (includes auto-fields like created_at)
        if (result.data) {
          const serverRowData: Record<string, unknown> = { id: result.data.id };
          for (const fv of result.data.fieldValues) {
            serverRowData[fv.fieldId] = fv.value;
          }
          setLocalRows(prev => prev.map(row =>
            String(row.id) === rowId ? serverRowData : row
          ));
        }
        setRowEditState(rowId, initialEditState);
      } else {
        console.error('[DataBlock] Save failed:', result.error);
        setRowEditState(rowId, { isSaving: false });
      }
    } catch (error) {
      console.error('[DataBlock] Save error:', error);
      setRowEditState(rowId, { isSaving: false });
    }
  };

  // Render a single row with optional edit mode
  const renderRow = (
    row: Record<string, unknown>,
    index: number,
    withEditControls = false
  ) => {
    const rowId = String(row.id);
    const rowEditState = getRowEditState(rowId);

    // If edit is not enabled or we don't want controls, just render normally
    if (!editEnabled || !withEditControls) {
      return (
        <div key={(row.id as number) || index} className={styles.item}>
          <RowDataProvider rowData={row} rowIndex={index} fields={_fields}>
            {renderTemplateContent()}
          </RowDataProvider>
        </div>
      );
    }

    const cancelHandler = createCancelForRow(rowId);
    const setEditModeHandler = createSetEditModeForRow(rowId);

    // With edit controls - wrap in EditableRowProvider
    return (
      <div key={(row.id as number) || index} className={cn(styles.item, styles.editableItem)}>
        <RowDataProvider rowData={row} rowIndex={index} fields={_fields}>
            <EditableRowProvider
              isEditMode={rowEditState.isEditMode}
              isSaving={rowEditState.isSaving}
              tableId={_tableId ?? null}
              rowId={rowId}
              cancel={cancelHandler}
              setEditMode={setEditModeHandler}
            >
              {rowEditState.isEditMode ? (
                <form onSubmit={(e) => handleRowFormSubmit(e, rowId)}>
                  <div className={styles.rowWrapper}>
                    {/* Row content */}
                    {renderTemplateContent()}

                    {/* Row edit controls */}
                    <div className={styles.rowEditControls}>
                      <Button
                        type="submit"
                        size="sm"
                        variant="default"
                        disabled={rowEditState.isSaving}
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={cancelHandler}
                        disabled={rowEditState.isSaving}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </form>
              ) : (
                <div className={styles.rowWrapper}>
                  {/* Row content */}
                  {renderTemplateContent()}

                  {/* Row edit controls */}
                  <div className={styles.rowEditControls}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditModeHandler(true)}
                      className={styles.rowEditButton}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </EditableRowProvider>
        </RowDataProvider>
      </div>
    );
  };

  // Render rows content using template
  const renderRows = (rows: Record<string, unknown>[], withEditControls = false) => (
    <div className={styles.repeatContainer} style={containerStyle}>
      {rows.map((row, index) => renderRow(row, index, withEditControls))}
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

  // Helper to render all rows (used in preview/public mode and editor preview)
  const renderAllRows = (showEditControls = false) => (
    <>
      {mergedDisplayedRows.length === 0 ? (
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
                  style={{ gap: `var(--spacing-${gap}, 16px)` }}
                >
                  {mergedDisplayedRows.map((row, index) => (
                    <div key={(row.id as number) || index} className={styles.carouselItem}>
                      {renderRow(row, index, showEditControls)}
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
                {renderRows(mergedDisplayedRows, showEditControls)}
              </div>
            )
          )}

          {/* Pagination controls */}
          {renderPaginationControls()}

          {/* Add new row button */}
          {allowCreate && !isEditing && (
            <div className={styles.addRowContainer}>
              <Button
                variant="outline"
                onClick={handleCreateNewRow}
                disabled={isCreatingNew}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New
              </Button>
            </div>
          )}
        </>
      )}

      {/* Create row dialog */}
      {allowCreate && (
        <CreateRowDialog
          open={isCreatingNew}
          onClose={handleCancelCreate}
          onSave={handleSaveNewRow}
          fields={_fields}
          isSaving={isCreatingSaving}
          errors={newRowErrors}
        />
      )}
    </>
  );

  // Not in editor (preview/public) - show all rows with edit controls if enabled
  if (!isEditing) {
    return (
      <Section>
        <div className={styles.dataBlock}>
          {renderAllRows(editEnabled)}
        </div>
      </Section>
    );
  }

  // ============================================
  // EDITOR MODE: ConditionalBlock-style floating bar
  // ============================================

  // Render a single template preview row for edit mode
  const renderSingleTemplatePreview = () => {
    const sampleRow = _rows[0] || {};
    return wrapWithDataLayout(
      <RowDataProvider rowData={sampleRow} rowIndex={0} fields={_fields}>
        {renderTemplateContent()}
      </RowDataProvider>
    );
  };

  return (
    <Section>
      <div className="relative border-2 border-dashed border-purple-300 rounded-lg p-3 min-h-[60px]">
        {/* ConditionalBlock-style floating bar at top */}
        <div
          ref={barRef}
          className="absolute -top-3 left-2 bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full flex items-center gap-1.5 font-mono z-50"
        >
          <Database className="h-3 w-3" />
          <span className="max-w-[120px] truncate">{_viewName || 'DataBlock'}</span>
          <span className="text-purple-500">({mergedDisplayedRows.length} rows)</span>

          {/* Divider */}
          <div className="w-px h-3 bg-purple-300 mx-1" />

          {/* Edit/Preview toggle */}
          <div className="flex gap-0.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setViewMode('edit'); }}
              className={cn(
                "p-0.5 rounded transition-colors",
                viewMode === 'edit' ? "bg-purple-200" : "hover:bg-purple-200/50"
              )}
              title="Edit mode - show single row"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setViewMode('preview'); }}
              className={cn(
                "p-0.5 rounded transition-colors",
                viewMode === 'preview' ? "bg-purple-200" : "hover:bg-purple-200/50"
              )}
              title="Preview mode - show all rows"
            >
              <Eye className="h-3 w-3" />
            </button>
          </div>

          {/* Divider */}
          <div className="w-px h-3 bg-purple-300 mx-1" />

          {/* Edit Template button */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleEditTemplate(); }}
            className="px-1.5 py-0.5 rounded hover:bg-purple-200 transition-colors"
          >
            Edit Template
          </button>
        </div>

        {/* Content area */}
        <div className="mt-2">
          {!hasTemplate ? (
            <div className="text-muted-foreground text-sm py-4 text-center border-2 border-dashed rounded-md">
              No template content - click "Edit Template" to add components
            </div>
          ) : viewMode === 'edit' ? (
            // Edit mode: show single row template
            renderSingleTemplatePreview()
          ) : (
            // Preview mode: show all rows
            <div className={styles.dataBlock}>
              {renderAllRows(false)}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}
