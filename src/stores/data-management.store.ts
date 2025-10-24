/**
 * Data Management Store - Replaces DataViewsClient and TableEditorClient useState patterns
 * 
 * Centralizes all data-related state including table selection, field management,
 * row operations, and data view states. This store replaces multiple useState 
 * patterns across data components with performant, type-safe state management.
 * 
 * AIDEV-NOTE: This replaces 10+ useState calls across DataViewsClient, TableEditorClient,
 * and related components with fine-grained reactivity for data management features.
 */

import { Store } from '@tanstack/react-store'
import type { TableDTO } from '@/app/mappers/table-mapper'
import type { FieldDTO } from '@/app/mappers/field-mapper'
import type { RowDTO, FieldValueDTO } from '@/app/mappers/row-mapper'
import type { FilterConfig } from '@/lib/types/filters'

export interface DataState {
  // Current selection
  selectedTableId?: number
  selectedDatabaseId?: number
  
  // Table and field data
  fields: FieldDTO[]
  rows: RowDTO[]
  availableTables: Array<{ id: number; name: string }>
  
  // Search and filtering
  searchTerm: string
  fieldFilter: string
  activeFilters: FilterConfig[]
  rowFilter: {
    field?: string
    operator?: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan'
    value?: any
  }
  sortBy: {
    field?: string
    order?: 'asc' | 'desc'
  }
  
  // Pagination
  currentPage: number
  pageSize: number
  totalRows: number
  
  // Loading states
  isLoading: boolean
  isRefreshing: boolean
  fieldsLoading: boolean
  rowsLoading: boolean
  error: string | null
  
  // UI state
  view: 'table' | 'grid' | 'chart'
  isFieldManagerOpen: boolean
  isRowFormOpen: boolean
  isImportDialogOpen: boolean
  isExportDialogOpen: boolean
  
  // Editing state
  editingRowId: string | null
  editingCellId: string | null
  newRowData: Record<string, any>
  editRowData: Record<string, any>
  
  // Selection state
  selectedRowIds: string[]
  selectedCellIds: string[]
  bulkOperationInProgress: boolean
  
  // Field management
  fieldCreationMode: boolean
  editingFieldId?: number
  fieldFormData: {
    name: string
    type: string
    required: boolean
    defaultValue?: any
    relationTable?: number
    description?: string
  }
  fieldErrors: Record<string, string>
  
  // Row operations
  showNewRow: boolean
  validationErrors: Record<string, string>
  
  // Data quality
  duplicateRows: string[]
  invalidRows: string[]
  dataQualityScore: number
  
  // Export/Import
  exportFormat: 'csv' | 'json' | 'xlsx'
  importProgress: number
  exportProgress: number
  
  // Real-time updates
  subscribeToChanges: boolean
  pendingChanges: Array<{
    id: string
    type: 'create' | 'update' | 'delete'
    data: any
    timestamp: Date
  }>
  
  // History/Undo
  undoStack: Array<{
    action: string
    data: any
    timestamp: Date
  }>
  canUndo: boolean
  canRedo: boolean
  
  // Performance tracking
  lastQueryTime: number
  queryPerformanceHistory: number[]
}

const initialState: DataState = {
  // Selection
  selectedTableId: undefined,
  selectedDatabaseId: undefined,
  
  // Data
  fields: [],
  rows: [],
  availableTables: [],
  
  // Search and filtering
  searchTerm: '',
  fieldFilter: '',
  activeFilters: [],
  rowFilter: {},
  sortBy: {},
  
  // Pagination
  currentPage: 1,
  pageSize: 50,
  totalRows: 0,
  
  // Loading
  isLoading: false,
  isRefreshing: false,
  fieldsLoading: false,
  rowsLoading: false,
  error: null,
  
  // UI
  view: 'table',
  isFieldManagerOpen: false,
  isRowFormOpen: false,
  isImportDialogOpen: false,
  isExportDialogOpen: false,
  
  // Editing
  editingRowId: null,
  editingCellId: null,
  newRowData: {},
  editRowData: {},
  
  // Selection
  selectedRowIds: [],
  selectedCellIds: [],
  bulkOperationInProgress: false,
  
  // Field management
  fieldCreationMode: false,
  editingFieldId: undefined,
  fieldFormData: {
    name: '',
    type: 'text',
    required: false,
    defaultValue: undefined,
    relationTable: undefined,
    description: ''
  },
  fieldErrors: {},
  
  // Row operations
  showNewRow: false,
  validationErrors: {},
  
  // Data quality
  duplicateRows: [],
  invalidRows: [],
  dataQualityScore: 100,
  
  // Export/Import
  exportFormat: 'csv',
  importProgress: 0,
  exportProgress: 0,
  
  // Real-time
  subscribeToChanges: false,
  pendingChanges: [],
  
  // History
  undoStack: [],
  canUndo: false,
  canRedo: false,
  
  // Performance
  lastQueryTime: 0,
  queryPerformanceHistory: []
}

// Create the data management store
export const dataStore = new Store(initialState)

// Store actions for data management
export const dataActions = {
  // Selection actions
  setSelectedTable: (tableId?: number) => {
    dataStore.setState((state) => ({
      ...state,
      selectedTableId: tableId,
      // Reset related data when table changes
      fields: [],
      rows: [],
      selectedRowIds: [],
      editingRowId: null,
      searchTerm: '',
      currentPage: 1
    }))
  },

  setSelectedDatabase: (databaseId?: number) => {
    dataStore.setState((state) => ({ ...state, selectedDatabaseId: databaseId }))
  },

  // Data loading actions
  setFields: (fields: FieldDTO[]) => {
    dataStore.setState((state) => ({ ...state, fields, fieldsLoading: false }))
  },

  setRows: (rows: RowDTO[], totalRows?: number) => {
    dataStore.setState((state) => ({ 
      ...state, 
      rows,
      totalRows: totalRows || rows.length,
      rowsLoading: false 
    }))
  },

  setAvailableTables: (tables: Array<{ id: number; name: string }>) => {
    dataStore.setState((state) => ({ ...state, availableTables: tables }))
  },

  // Search and filter actions
  setSearchTerm: (searchTerm: string) => {
    dataStore.setState((state) => ({ 
      ...state, 
      searchTerm,
      currentPage: 1 // Reset to first page on search
    }))
  },

  setFieldFilter: (fieldFilter: string) => {
    dataStore.setState((state) => ({ ...state, fieldFilter }))
  },

  setRowFilter: (filter: DataState['rowFilter']) => {
    dataStore.setState((state) => ({ 
      ...state, 
      rowFilter: filter,
      currentPage: 1 
    }))
  },

  setSorting: (field: string, order: 'asc' | 'desc') => {
    dataStore.setState((state) => ({
      ...state,
      sortBy: { field, order }
    }))
  },

  clearSorting: () => {
    dataStore.setState((state) => ({
      ...state,
      sortBy: {}
    }))
  },

  // Active filter actions
  addFilter: (filter: FilterConfig) => {
    dataStore.setState((state) => ({
      ...state,
      activeFilters: [...state.activeFilters, filter],
      currentPage: 1 // Reset to first page when filter changes
    }))
  },

  removeFilter: (index: number) => {
    dataStore.setState((state) => ({
      ...state,
      activeFilters: state.activeFilters.filter((_, i) => i !== index),
      currentPage: 1
    }))
  },

  clearActiveFilters: () => {
    dataStore.setState((state) => ({
      ...state,
      activeFilters: [],
      currentPage: 1
    }))
  },

  clearFilters: () => {
    dataStore.setState((state) => ({
      ...state,
      searchTerm: '',
      fieldFilter: '',
      activeFilters: [],
      rowFilter: {},
      // Keep sortBy - clearing filters should not clear sort
      currentPage: 1
    }))
  },

  // Pagination actions
  setCurrentPage: (page: number) => {
    dataStore.setState((state) => ({ ...state, currentPage: page }))
  },

  setPageSize: (size: number) => {
    dataStore.setState((state) => ({ 
      ...state, 
      pageSize: size,
      currentPage: 1 
    }))
  },

  // Loading state actions
  setLoading: (isLoading: boolean) => {
    dataStore.setState((state) => ({ 
      ...state, 
      isLoading,
      error: isLoading ? null : state.error 
    }))
  },

  setRefreshing: (isRefreshing: boolean) => {
    dataStore.setState((state) => ({ ...state, isRefreshing }))
  },

  setFieldsLoading: (loading: boolean) => {
    dataStore.setState((state) => ({ ...state, fieldsLoading: loading }))
  },

  setRowsLoading: (loading: boolean) => {
    dataStore.setState((state) => ({ ...state, rowsLoading: loading }))
  },

  setError: (error: string | null) => {
    dataStore.setState((state) => ({
      ...state,
      error,
      isLoading: false,
      isRefreshing: false,
      fieldsLoading: false,
      rowsLoading: false
    }))
  },

  // UI state actions
  setView: (view: DataState['view']) => {
    dataStore.setState((state) => ({ ...state, view }))
  },

  setFieldManagerOpen: (open: boolean) => {
    dataStore.setState((state) => ({ 
      ...state, 
      isFieldManagerOpen: open,
      // Reset field form when closing
      fieldFormData: open ? state.fieldFormData : {
        name: '',
        type: 'text',
        required: false,
        defaultValue: undefined,
        relationTable: undefined,
        description: ''
      },
      fieldErrors: open ? state.fieldErrors : {}
    }))
  },

  setRowFormOpen: (open: boolean) => {
    dataStore.setState((state) => ({ 
      ...state, 
      isRowFormOpen: open,
      newRowData: open ? state.newRowData : {},
      validationErrors: open ? state.validationErrors : {}
    }))
  },

  setImportDialogOpen: (open: boolean) => {
    dataStore.setState((state) => ({ 
      ...state, 
      isImportDialogOpen: open,
      importProgress: open ? state.importProgress : 0
    }))
  },

  setExportDialogOpen: (open: boolean) => {
    dataStore.setState((state) => ({ 
      ...state, 
      isExportDialogOpen: open,
      exportProgress: open ? state.exportProgress : 0
    }))
  },

  // Editing actions
  setEditingRow: (rowId: string | null) => {
    dataStore.setState((state) => ({ 
      ...state, 
      editingRowId: rowId,
      editRowData: rowId ? {} : state.editRowData
    }))
  },

  setEditingCell: (cellId: string | null) => {
    dataStore.setState((state) => ({ ...state, editingCellId: cellId }))
  },

  setNewRowData: (data: Record<string, any>) => {
    dataStore.setState((state) => ({ ...state, newRowData: data }))
  },

  setEditRowData: (data: Record<string, any>) => {
    dataStore.setState((state) => ({ ...state, editRowData: data }))
  },

  updateNewRowField: (fieldName: string, value: any) => {
    dataStore.setState((state) => ({
      ...state,
      newRowData: { ...state.newRowData, [fieldName]: value }
    }))
  },

  updateEditRowField: (fieldName: string, value: any) => {
    dataStore.setState((state) => ({
      ...state,
      editRowData: { ...state.editRowData, [fieldName]: value }
    }))
  },

  // Selection actions
  setSelectedRowIds: (rowIds: string[]) => {
    dataStore.setState((state) => ({ ...state, selectedRowIds: rowIds }))
  },

  toggleRowSelection: (rowId: string) => {
    dataStore.setState((state) => ({
      ...state,
      selectedRowIds: state.selectedRowIds.includes(rowId)
        ? state.selectedRowIds.filter(id => id !== rowId)
        : [...state.selectedRowIds, rowId]
    }))
  },

  selectAllRows: () => {
    dataStore.setState((state) => ({
      ...state,
      selectedRowIds: state.rows.map(row => row.id)
    }))
  },

  clearRowSelection: () => {
    dataStore.setState((state) => ({ ...state, selectedRowIds: [] }))
  },

  setBulkOperationInProgress: (inProgress: boolean) => {
    dataStore.setState((state) => ({ ...state, bulkOperationInProgress: inProgress }))
  },

  // Field management actions
  setFieldCreationMode: (mode: boolean) => {
    dataStore.setState((state) => ({ 
      ...state, 
      fieldCreationMode: mode,
      editingFieldId: mode ? undefined : state.editingFieldId
    }))
  },

  setEditingFieldId: (fieldId?: number) => {
    dataStore.setState((state) => ({ 
      ...state, 
      editingFieldId: fieldId,
      fieldCreationMode: false
    }))
  },

  setFieldFormData: (data: Partial<DataState['fieldFormData']>) => {
    dataStore.setState((state) => ({
      ...state,
      fieldFormData: { ...state.fieldFormData, ...data }
    }))
  },

  setFieldErrors: (errors: Record<string, string>) => {
    dataStore.setState((state) => ({ ...state, fieldErrors: errors }))
  },

  addField: (field: FieldDTO) => {
    dataStore.setState((state) => ({
      ...state,
      fields: [...state.fields, field]
    }))
  },

  updateField: (fieldId: number, updates: Partial<FieldDTO>) => {
    dataStore.setState((state) => ({
      ...state,
      fields: state.fields.map(field => 
        field.id === fieldId ? { ...field, ...updates } : field
      )
    }))
  },

  removeField: (fieldId: number) => {
    dataStore.setState((state) => ({
      ...state,
      fields: state.fields.filter(field => field.id !== fieldId)
    }))
  },

  // Row operations
  setShowNewRow: (show: boolean) => {
    dataStore.setState((state) => ({ ...state, showNewRow: show }))
  },

  setValidationErrors: (errors: Record<string, string>) => {
    dataStore.setState((state) => ({ ...state, validationErrors: errors }))
  },

  addRow: (row: RowDTO) => {
    dataStore.setState((state) => ({
      ...state,
      rows: [...state.rows, row],
      totalRows: state.totalRows + 1
    }))
  },

  updateRow: (rowId: string, updates: Partial<RowDTO>) => {
    dataStore.setState((state) => ({
      ...state,
      rows: state.rows.map(row => 
        row.id === rowId ? { ...row, ...updates } : row
      )
    }))
  },

  removeRow: (rowId: string) => {
    dataStore.setState((state) => ({
      ...state,
      rows: state.rows.filter(row => row.id !== rowId),
      totalRows: Math.max(0, state.totalRows - 1),
      selectedRowIds: state.selectedRowIds.filter(id => id !== rowId)
    }))
  },

  // Data quality actions
  setDuplicateRows: (rowIds: string[]) => {
    dataStore.setState((state) => ({ ...state, duplicateRows: rowIds }))
  },

  setInvalidRows: (rowIds: string[]) => {
    dataStore.setState((state) => ({ ...state, invalidRows: rowIds }))
  },

  setDataQualityScore: (score: number) => {
    dataStore.setState((state) => ({ ...state, dataQualityScore: score }))
  },

  // Export/Import actions
  setExportFormat: (format: DataState['exportFormat']) => {
    dataStore.setState((state) => ({ ...state, exportFormat: format }))
  },

  setImportProgress: (progress: number) => {
    dataStore.setState((state) => ({ ...state, importProgress: progress }))
  },

  setExportProgress: (progress: number) => {
    dataStore.setState((state) => ({ ...state, exportProgress: progress }))
  },

  // Real-time updates
  setSubscribeToChanges: (subscribe: boolean) => {
    dataStore.setState((state) => ({ ...state, subscribeToChanges: subscribe }))
  },

  addPendingChange: (change: DataState['pendingChanges'][0]) => {
    dataStore.setState((state) => ({
      ...state,
      pendingChanges: [...state.pendingChanges, change]
    }))
  },

  clearPendingChanges: () => {
    dataStore.setState((state) => ({ ...state, pendingChanges: [] }))
  },

  // History/Undo actions
  addToUndoStack: (action: DataState['undoStack'][0]) => {
    dataStore.setState((state) => ({
      ...state,
      undoStack: [action, ...state.undoStack.slice(0, 49)], // Keep last 50 actions
      canUndo: true
    }))
  },

  clearUndoStack: () => {
    dataStore.setState((state) => ({ 
      ...state, 
      undoStack: [],
      canUndo: false,
      canRedo: false
    }))
  },

  // Performance tracking
  setLastQueryTime: (time: number) => {
    dataStore.setState((state) => ({
      ...state,
      lastQueryTime: time,
      queryPerformanceHistory: [time, ...state.queryPerformanceHistory.slice(0, 99)] // Keep last 100
    }))
  },

  // Reset actions
  reset: () => {
    dataStore.setState(initialState)
  },

  resetForNewTable: () => {
    dataStore.setState((state) => ({
      ...state,
      fields: [],
      rows: [],
      selectedRowIds: [],
      editingRowId: null,
      editingCellId: null,
      searchTerm: '',
      rowFilter: {},
      currentPage: 1,
      error: null
    }))
  }
}

// Common selectors for data state
export const dataSelectors = {
  // Selection selectors
  selectedTableId: (state: DataState) => state.selectedTableId,
  selectedDatabaseId: (state: DataState) => state.selectedDatabaseId,
  selectedTable: (availableTables: Array<{ id: number; name: string }>) => (state: DataState) =>
    availableTables.find(table => table.id === state.selectedTableId),

  // Data selectors
  fields: (state: DataState) => state.fields,
  rows: (state: DataState) => state.rows,
  availableTables: (state: DataState) => state.availableTables,
  
  // Filtered data selectors
  filteredRows: (state: DataState) => {
    let filtered = state.rows

    // Apply search filter
    if (state.searchTerm) {
      filtered = filtered.filter(row => {
        // Search across all field values
        return row.fieldValues.some(fv => 
          String(fv.value).toLowerCase().includes(state.searchTerm.toLowerCase())
        ) || row.id.toLowerCase().includes(state.searchTerm.toLowerCase())
      })
    }

    // Apply row filter
    if (state.rowFilter.field && state.rowFilter.value !== undefined) {
      filtered = filtered.filter(row => {
        const fieldValue = row.fieldValues.find(fv => fv.fieldSlug === state.rowFilter.field)?.value
        const filterValue = state.rowFilter.value

        switch (state.rowFilter.operator) {
          case 'equals':
            return fieldValue === filterValue
          case 'contains':
            return String(fieldValue).toLowerCase().includes(String(filterValue).toLowerCase())
          case 'startsWith':
            return String(fieldValue).toLowerCase().startsWith(String(filterValue).toLowerCase())
          case 'endsWith':
            return String(fieldValue).toLowerCase().endsWith(String(filterValue).toLowerCase())
          case 'greaterThan':
            return Number(fieldValue) > Number(filterValue)
          case 'lessThan':
            return Number(fieldValue) < Number(filterValue)
          default:
            return true
        }
      })
    }

    // Apply sorting
    if (state.sortBy.field) {
      filtered.sort((a, b) => {
        const aValue = a.fieldValues.find(fv => fv.fieldSlug === state.sortBy.field)?.value || ''
        const bValue = b.fieldValues.find(fv => fv.fieldSlug === state.sortBy.field)?.value || ''
        
        let compareResult = 0
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          compareResult = aValue - bValue
        } else {
          compareResult = String(aValue).localeCompare(String(bValue))
        }

        return (state.sortBy.order || 'asc') === 'asc' ? compareResult : -compareResult
      })
    }

    return filtered
  },

  // Paginated data
  paginatedRows: (state: DataState) => {
    const startIndex = (state.currentPage - 1) * state.pageSize
    const endIndex = startIndex + state.pageSize
    return dataSelectors.filteredRows(state).slice(startIndex, endIndex)
  },

  // Search and filter selectors
  searchTerm: (state: DataState) => state.searchTerm,
  fieldFilter: (state: DataState) => state.fieldFilter,
  activeFilters: (state: DataState) => state.activeFilters,
  rowFilter: (state: DataState) => state.rowFilter,
  sortBy: (state: DataState) => state.sortBy,

  // Pagination selectors
  currentPage: (state: DataState) => state.currentPage,
  pageSize: (state: DataState) => state.pageSize,
  totalRows: (state: DataState) => state.totalRows,
  totalPages: (state: DataState) => Math.ceil(state.totalRows / state.pageSize),
  hasNextPage: (state: DataState) => state.currentPage < Math.ceil(state.totalRows / state.pageSize),
  hasPrevPage: (state: DataState) => state.currentPage > 1,

  // Loading selectors
  isLoading: (state: DataState) => state.isLoading,
  isRefreshing: (state: DataState) => state.isRefreshing,
  fieldsLoading: (state: DataState) => state.fieldsLoading,
  rowsLoading: (state: DataState) => state.rowsLoading,
  error: (state: DataState) => state.error,
  hasError: (state: DataState) => !!state.error,

  // UI state selectors
  view: (state: DataState) => state.view,
  isFieldManagerOpen: (state: DataState) => state.isFieldManagerOpen,
  isRowFormOpen: (state: DataState) => state.isRowFormOpen,
  isImportDialogOpen: (state: DataState) => state.isImportDialogOpen,
  isExportDialogOpen: (state: DataState) => state.isExportDialogOpen,

  // Editing selectors
  editingRowId: (state: DataState) => state.editingRowId,
  editingCellId: (state: DataState) => state.editingCellId,
  isEditingRow: (rowId: string) => (state: DataState) => state.editingRowId === rowId,
  isEditingCell: (cellId: string) => (state: DataState) => state.editingCellId === cellId,
  newRowData: (state: DataState) => state.newRowData,
  editRowData: (state: DataState) => state.editRowData,

  // Selection selectors
  selectedRowIds: (state: DataState) => state.selectedRowIds,
  selectedRows: (state: DataState) => 
    state.rows.filter(row => state.selectedRowIds.includes(row.id)),
  isRowSelected: (rowId: string) => (state: DataState) => 
    state.selectedRowIds.includes(rowId),
  hasSelectedRows: (state: DataState) => state.selectedRowIds.length > 0,
  selectedRowCount: (state: DataState) => state.selectedRowIds.length,
  bulkOperationInProgress: (state: DataState) => state.bulkOperationInProgress,

  // Field management selectors
  fieldCreationMode: (state: DataState) => state.fieldCreationMode,
  editingFieldId: (state: DataState) => state.editingFieldId,
  fieldFormData: (state: DataState) => state.fieldFormData,
  fieldErrors: (state: DataState) => state.fieldErrors,
  hasFieldErrors: (state: DataState) => Object.keys(state.fieldErrors).length > 0,
  getFieldById: (fieldId: number) => (state: DataState) => 
    state.fields.find(field => field.id === fieldId),

  // Data quality selectors
  duplicateRows: (state: DataState) => state.duplicateRows,
  invalidRows: (state: DataState) => state.invalidRows,
  dataQualityScore: (state: DataState) => state.dataQualityScore,
  hasDataQualityIssues: (state: DataState) => 
    state.duplicateRows.length > 0 || state.invalidRows.length > 0,

  // Performance selectors
  lastQueryTime: (state: DataState) => state.lastQueryTime,
  averageQueryTime: (state: DataState) => {
    const history = state.queryPerformanceHistory
    return history.length > 0 ? history.reduce((sum, time) => sum + time, 0) / history.length : 0
  },

  // Real-time selectors
  subscribeToChanges: (state: DataState) => state.subscribeToChanges,
  pendingChanges: (state: DataState) => state.pendingChanges,
  hasPendingChanges: (state: DataState) => state.pendingChanges.length > 0,

  // History selectors
  canUndo: (state: DataState) => state.canUndo,
  canRedo: (state: DataState) => state.canRedo,
  undoStack: (state: DataState) => state.undoStack
}

