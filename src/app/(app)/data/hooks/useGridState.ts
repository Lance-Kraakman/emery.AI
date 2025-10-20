import { useReducer, useEffect } from 'react'
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
  | { type: 'SET_DATA'; payload: DSGRow[] }           // Server data loaded
  | { type: 'CELL_CHANGED'; payload: { rowId: string; fieldId: number; value: any } }
  | { type: 'ROW_ADDED'; payload: DSGRow }
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

    case 'CELL_CHANGED':
    case 'ROW_ADDED':
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

  // Sync server data to state (TanStack Query manages server state)
  useEffect(() => {
    dispatch({ type: 'SET_DATA', payload: rows })
    dispatch({ type: 'SYNC_COMPLETE' })  // Server update means sync is done
  }, [rows])

  return { state, dispatch }
}
