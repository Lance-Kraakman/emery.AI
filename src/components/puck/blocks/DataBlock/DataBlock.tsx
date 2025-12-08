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
 * Template Editing UX (list mode):
 * - Default: Shows all rows as preview with corner edit button
 * - Edit mode: Shows single editable template row
 * - No template: Shows centered "Edit Template" button
 *
 * Data Edit Mode:
 * - When editEnabled=true, field blocks can render as inputs
 * - Save is always manual (requires save button)
 */

import { useState, useRef, useEffect, useCallback, type ComponentType } from 'react';
import { registerOverlayPortal } from '@measured/puck';
import { RowDataProvider } from '@/components/puck/contexts/RowDataContext';
import { DataLayoutProvider } from '@/components/puck/contexts/DataLayoutContext';
import { EditableRowProvider } from '@/components/puck/contexts/EditableRowContext';
import { useLinkContext } from '@/components/puck/link-context';
import { useEditorUI } from '@/components/puck/contexts/EditorUIContext';
import { usePagination } from './usePagination';
import { updateRowData, createRow } from '@/app/actions/rows';
import { Button } from '@/components/ui/button';
import { Section } from '@/components/puck/components/Section';
import { Pencil, Check, ChevronLeft, ChevronRight, Save, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FieldDTO } from '@/app/mappers/field-mapper';
import type { SingleRowFilterConfig } from '../../fields/SingleRowFilterField';
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

  // Single mode: Filter-based row selection
  singleRowFilter?: SingleRowFilterConfig;

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

  // Slot for item template - Puck passes this as a renderable component
  // Slot props: className, allow, disallow, minEmptyHeight, style, ref
  children?: ComponentType<{
    className?: string;
    allow?: string[];
    disallow?: string[];
  }>;
}

export default function DataBlock({
  mode = 'single',
  viewId,
  singleRowFilter,
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
  children: Children,
}: DataBlockProps) {
  // Template editing state (list mode only)
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const doneButtonRef = useRef<HTMLButtonElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Get editing context (Puck editor vs preview/public)
  const { isEditing } = useLinkContext();

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

  // Get UI navigation context (only available in editor)
  let navigateToTab: ((tab: 'blocks' | 'fields' | 'outline') => void) | null = null;
  let expandCategory: ((category: string) => void) | null = null;
  try {
    const editorUI = useEditorUI();
    navigateToTab = editorUI.navigateToTab;
    expandCategory = editorUI.expandCategory;
  } catch {
    // Context not available - we're not in the editor (preview/public)
    navigateToTab = null;
    expandCategory = null;
  }

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

  const hasTemplate = Children !== undefined;

  // Carousel scroll helper
  const scrollCarousel = (direction: 'left' | 'right') => {
    carouselRef.current?.scrollBy({
      left: direction === 'left' ? -300 : 300,
      behavior: 'smooth',
    });
  };

  // Handle edit template action - switch to edit mode, navigate to Blocks tab, and expand Fields category
  const handleEditTemplate = () => {
    setIsEditingTemplate(true);
    if (navigateToTab && expandCategory) {
      // Switch to blocks tab and expand the fields category
      navigateToTab('blocks');
      expandCategory('fields');
    }
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
    // No filter configured - show help message
    if (!singleRowFilter?.field || !singleRowFilter?.value) {
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
    if (!_resolvedRow) {
      return (
        <Section>
          <div className={styles.empty}>
            <p className={styles.emptyText}>
              No data found for filter: {singleRowFilter.field} {singleRowFilter.operator || 'equals'} {singleRowFilter.value}
            </p>
          </div>
        </Section>
      );
    }

    const rowId = String(_resolvedRow.id);

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
          // Optimistic update: convert field names to IDs and merge into local row data
          const dataWithIds = convertFieldNamesToIds(data);
          setLocalRowData(prev => prev ? { ...prev, ...dataWithIds } : prev);
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

    return (
      <Section>
        <div className={styles.dataBlock}>
          {/* Content with row context - uses slot */}
          {wrapWithDataLayout(
            <RowDataProvider rowData={displayRow!} rowIndex={0}>
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
                      {Children && <Children />}
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
                    {Children && <Children />}
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
                  {Children && <Children />}
                </div>
              )}
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
        // Optimistic update: convert field names to IDs and update the specific row
        const dataWithIds = convertFieldNamesToIds(data);
        setLocalRows(prev => prev.map(row =>
          String(row.id) === rowId ? { ...row, ...dataWithIds } : row
        ));
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
    disableDrops = false,
    withEditControls = false
  ) => {
    const rowId = String(row.id);
    const rowEditState = getRowEditState(rowId);

    // If edit is not enabled or we don't want controls, just render normally
    if (!editEnabled || !withEditControls) {
      return (
        <div key={(row.id as number) || index} className={styles.item}>
          <RowDataProvider rowData={row} rowIndex={index}>
            {Children && <Children allow={disableDrops ? [] : undefined} />}
          </RowDataProvider>
        </div>
      );
    }

    const cancelHandler = createCancelForRow(rowId);
    const setEditModeHandler = createSetEditModeForRow(rowId);

    // With edit controls - wrap in EditableRowProvider
    return (
      <div key={(row.id as number) || index} className={cn(styles.item, styles.editableItem)}>
        <RowDataProvider rowData={row} rowIndex={index}>
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
                  {Children && <Children allow={disableDrops ? [] : undefined} />}

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
                {Children && <Children allow={disableDrops ? [] : undefined} />}

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

  // Render rows content using Children slot
  // Pass allow={[]} to disable dropping in preview rows
  const renderRows = (rows: Record<string, unknown>[], disableDrops = false, withEditControls = false) => (
    <div className={styles.repeatContainer} style={containerStyle}>
      {rows.map((row, index) => renderRow(row, index, disableDrops, withEditControls))}
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
                        {renderRow(row, index, false, editEnabled)}
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
                  {renderRows(mergedDisplayedRows, false, editEnabled)}
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
          <Button onClick={handleEditTemplate}>
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
            variant="secondary"
            className="absolute top-2 right-2 z-10"
            onClick={handleEditTemplate}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit Template
          </Button>

          {/* Preview rows - disable drops with allow={[]} */}
          {mergedDisplayedRows.length === 0 ? (
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
                    {mergedDisplayedRows.map((row, index) => (
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
