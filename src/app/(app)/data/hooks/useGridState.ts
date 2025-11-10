import { useReducer, useEffect, useRef } from 'react'
import type { DSGRow } from '@/app/mappers/dsg-mapper'

/**
 * Grid state - minimal, just tracks display data and sync status
 * TanStack Query manages server state, we just track local UI state
 */
export interface GridState {
  data: DSGRow[]              // Current displayed data
  isSyncing: boolean          // Is a save operation in progress?
}

/**
 * Grid actions - map 1:1 to user events and mutations
 */
export type GridAction =
  | { type: 'SET_DATA'; payload: DSGRow[] }           // Server data loaded (initial/replace)
  | { type: 'APPEND_DATA'; payload: DSGRow[] }        // Append more rows (infinite scroll)
  | { type: 'CELL_CHANGED'; payload: { rowId: string; fieldId: number; value: any } }
  | { type: 'ROW_ADDED'; payload: DSGRow }
  | { type: 'ROW_DELETED'; payload: string }          // Row ID deleted
  | { type: 'START_SYNC' }
  | { type: 'SYNC_COMPLETE' }

/**
 * Reducer - handles state transitions
 * Note: We don't update data here for changes, TanStack Query handles that via optimistic updates
 */
function gridReducer(state: GridState, action: GridAction): GridState {
  switch (action.type) {
    case 'SET_DATA':
      return { ...state, data: action.payload }

    case 'APPEND_DATA':
      // Append new rows without replacing existing data (preserves scroll position)
      return { ...state, data: [...state.data, ...action.payload] }

    case 'CELL_CHANGED':
    case 'ROW_ADDED':
    case 'ROW_DELETED':
      // Don't update state here - TanStack Query mutation handles optimistic update
      // Just track that we're syncing
      return { ...state, isSyncing: true }

    case 'START_SYNC':
      return { ...state, isSyncing: true }

    case 'SYNC_COMPLETE':
      return { ...state, isSyncing: false }

    default:
      return state
  }
}

/**
 * Custom hook for managing grid state with reducer pattern
 * Syncs with server data via TanStack Query
 */
export function useGridState(rows: DSGRow[]) {
  const [state, dispatch] = useReducer(gridReducer, {
    data: rows,
    isSyncing: false
  })

  const prevLengthRef = useRef(rows.length)

  // Sync server data to state (TanStack Query manages server state)
  useEffect(() => {
    const prevLength = prevLengthRef.current
    const currentLength = rows.length

    // Detect if this is an append (infinite scroll loaded more data)
    // vs a replace (table changed, filter applied, or initial load)
    const isAppending = currentLength > prevLength &&
                       state.data.length > 0 &&
                       currentLength > state.data.length

    if (isAppending) {
      // Extract only the new rows that were added
      const newRows = rows.slice(prevLength)
      dispatch({ type: 'APPEND_DATA', payload: newRows })
    } else {
      // Full replace for table changes, filters, or initial load
      dispatch({ type: 'SET_DATA', payload: rows })
    }

    dispatch({ type: 'SYNC_COMPLETE' })  // Server update means sync is done
    prevLengthRef.current = currentLength
  }, [rows, state.data.length])

  return { state, dispatch }
}
