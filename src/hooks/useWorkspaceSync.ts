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

// Delta sync results (more detailed)
interface DeltaPullResult {
  files_added: string[];
  files_updated: string[];
  files_skipped: string[];  // Conflicts saved as .agent files
  timestamp: number;
}

interface DeltaPushResult {
  files_added: number;
  files_updated: number;
  files_deleted: number;
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
  lastSyncResult: DeltaPullResult | DeltaPushResult | null;
  selectFolder: () => Promise<void>;
  checkStatus: () => Promise<void>;
  pull: () => Promise<DeltaPullResult | null>;
  push: () => Promise<DeltaPushResult | null>;
  pullFull: () => Promise<PullResult | null>;
  pushFull: () => Promise<PushResult | null>;
  clearAgentFiles: () => Promise<number>;
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
  const [lastSyncResult, setLastSyncResult] = useState<DeltaPullResult | DeltaPushResult | null>(null);

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

  // Delta pull: Only downloads changed files, preserves user edits
  const pull = useCallback(async (): Promise<DeltaPullResult | null> => {
    if (!isAvailable || !syncPath) return null;

    try {
      setError(null);
      setSyncState('syncing');

      const apiKey = await getApiKey();
      const apiBase = getApiBase();

      const result = await invokeTauri<DeltaPullResult>('pull_workspace_delta', {
        agentId,
        localPath: syncPath,
        apiKey,
        apiBase,
      });

      // Check if there were conflicts (files saved as .agent versions)
      setHasConflict(result.files_skipped.length > 0);
      setLastSyncResult(result);
      setSyncState('idle');

      // Refresh status after successful pull
      checkStatus().catch(console.error);

      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pull workspace');
      setSyncState('error');
      return null;
    }
  }, [agentId, isAvailable, syncPath, getApiKey, getApiBase, checkStatus]);

  // Delta push: Only uploads changed files
  const push = useCallback(async (): Promise<DeltaPushResult | null> => {
    if (!isAvailable || !syncPath) return null;

    try {
      setError(null);
      setSyncState('syncing');

      const apiKey = await getApiKey();
      const apiBase = getApiBase();

      const result = await invokeTauri<DeltaPushResult>('push_workspace_delta', {
        agentId,
        localPath: syncPath,
        apiKey,
        apiBase,
      });

      setHasConflict(false);
      setLastSyncResult(result);
      setSyncState('idle');

      // Refresh status after successful push
      checkStatus().catch(console.error);

      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to push workspace');
      setSyncState('error');
      return null;
    }
  }, [agentId, isAvailable, syncPath, getApiKey, getApiBase, checkStatus]);

  // Full pull: Downloads entire workspace (overwrites local)
  const pullFull = useCallback(async (): Promise<PullResult | null> => {
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

      checkStatus().catch(console.error);

      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pull workspace');
      setSyncState('error');
      return null;
    }
  }, [agentId, isAvailable, syncPath, getApiKey, getApiBase, checkStatus]);

  // Full push: Uploads entire workspace (overwrites remote)
  const pushFull = useCallback(async (): Promise<PushResult | null> => {
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

      checkStatus().catch(console.error);

      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to push workspace');
      setSyncState('error');
      return null;
    }
  }, [agentId, isAvailable, syncPath, getApiKey, getApiBase, checkStatus]);

  // Clear all .agent.* conflict files
  const clearAgentFiles = useCallback(async (): Promise<number> => {
    if (!isAvailable || !syncPath) return 0;

    try {
      const count = await invokeTauri<number>('clear_agent_files', {
        localPath: syncPath,
      });
      setHasConflict(false);
      return count;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear agent files');
      return 0;
    }
  }, [isAvailable, syncPath]);

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
    lastSyncResult,
    selectFolder,
    checkStatus,
    pull,
    push,
    pullFull,
    pushFull,
    clearAgentFiles,
    disconnect,
    resolveConflict,
  };
}
