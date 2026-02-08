/**
 * Workspace Sync Hook
 *
 * Provides workspace sync functionality for Tauri desktop app.
 * Handles local folder selection, pull/push operations, and conflict detection.
 */

import { useState, useEffect, useCallback } from 'react';
import { isTauri } from './useDeviceFlow';

interface SyncConfig {
  folder_path: string;
  last_sync: number | null;
}

interface SyncStatus {
  local_modified: number | null;
  remote_modified: number | null;
  has_conflict: boolean;
  needs_pull: boolean;
  needs_push: boolean;
}

interface PullResult {
  files_extracted: number;
  timestamp: number;
}

interface PushResult {
  files_archived: number;
  timestamp: number;
}

export type SyncState = 'idle' | 'syncing' | 'error';

export interface UseWorkspaceSyncReturn {
  isAvailable: boolean;
  syncPath: string | null;
  status: SyncStatus | null;
  syncState: SyncState;
  error: string | null;
  hasConflict: boolean;
  selectFolder: () => Promise<void>;
  checkStatus: () => Promise<void>;
  pull: () => Promise<PullResult | null>;
  push: () => Promise<PushResult | null>;
  disconnect: () => Promise<void>;
  resolveConflict: (resolution: 'keep_local' | 'keep_remote') => Promise<void>;
}

// Dynamic import for Tauri API (only available in Tauri context)
async function invokeTauri<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new Error('Tauri API not available');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}

export function useWorkspaceSync(agentId: number): UseWorkspaceSyncReturn {
  const [syncPath, setSyncPath] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [hasConflict, setHasConflict] = useState(false);

  const isAvailable = isTauri();

  // Get API base URL
  const getApiBase = useCallback(() => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  }, []);

  // Get stored API key
  const getApiKey = useCallback(async (): Promise<string> => {
    const apiKey = await invokeTauri<string | null>('get_api_key');
    if (!apiKey) {
      throw new Error('No API key configured. Please sign out and sign in again.');
    }
    return apiKey;
  }, []);

  // Load saved config on mount
  useEffect(() => {
    if (!isAvailable) return;

    const loadConfig = async () => {
      try {
        const config = await invokeTauri<SyncConfig | null>('get_sync_config', {
          agentId,
        });
        if (config) {
          setSyncPath(config.folder_path);
        }
      } catch (err) {
        console.error('Failed to load sync config:', err);
      }
    };

    loadConfig();
  }, [agentId, isAvailable]);

  const selectFolder = useCallback(async () => {
    if (!isAvailable) return;

    try {
      setError(null);
      const path = await invokeTauri<string>('select_sync_folder');
      await invokeTauri('set_sync_config', {
        agentId,
        folderPath: path,
      });
      setSyncPath(path);
    } catch (err) {
      if (err instanceof Error && err.message.includes('cancelled')) {
        return; // User cancelled, not an error
      }
      setError(err instanceof Error ? err.message : 'Failed to select folder');
    }
  }, [agentId, isAvailable]);

  const checkStatus = useCallback(async () => {
    if (!isAvailable || !syncPath) return;

    try {
      setError(null);
      const apiKey = await getApiKey();
      const apiBase = getApiBase();

      const result = await invokeTauri<SyncStatus>('check_sync_status', {
        agentId,
        apiKey,
        apiBase,
      });

      setStatus(result);
      setHasConflict(result.has_conflict);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check sync status');
    }
  }, [agentId, isAvailable, syncPath, getApiKey, getApiBase]);

  const pull = useCallback(async (): Promise<PullResult | null> => {
    if (!isAvailable || !syncPath) return null;

    try {
      setError(null);
      setSyncState('syncing');

      const apiKey = await getApiKey();
      const apiBase = getApiBase();

      const result = await invokeTauri<PullResult>('pull_workspace', {
        agentId,
        localPath: syncPath,
        apiKey,
        apiBase,
      });

      setHasConflict(false);
      setSyncState('idle');

      // Refresh status after successful pull (don't await to avoid blocking return)
      checkStatus().catch(console.error);

      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pull workspace');
      setSyncState('error');
      return null;
    }
  }, [agentId, isAvailable, syncPath, getApiKey, getApiBase, checkStatus]);

  const push = useCallback(async (): Promise<PushResult | null> => {
    if (!isAvailable || !syncPath) return null;

    try {
      setError(null);
      setSyncState('syncing');

      const apiKey = await getApiKey();
      const apiBase = getApiBase();

      const result = await invokeTauri<PushResult>('push_workspace', {
        agentId,
        localPath: syncPath,
        apiKey,
        apiBase,
      });

      setHasConflict(false);
      setSyncState('idle');

      // Refresh status after successful push (don't await to avoid blocking return)
      checkStatus().catch(console.error);

      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to push workspace');
      setSyncState('error');
      return null;
    }
  }, [agentId, isAvailable, syncPath, getApiKey, getApiBase, checkStatus]);

  const disconnect = useCallback(async () => {
    if (!isAvailable) return;

    try {
      setError(null);
      await invokeTauri('set_sync_config', {
        agentId,
        folderPath: '',
      });
      setSyncPath(null);
      setStatus(null);
      setHasConflict(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  }, [agentId, isAvailable]);

  const resolveConflict = useCallback(
    async (resolution: 'keep_local' | 'keep_remote') => {
      if (resolution === 'keep_local') {
        await push();
      } else {
        await pull();
      }
    },
    [push, pull]
  );

  return {
    isAvailable,
    syncPath,
    status,
    syncState,
    error,
    hasConflict,
    selectFolder,
    checkStatus,
    pull,
    push,
    disconnect,
    resolveConflict,
  };
}
