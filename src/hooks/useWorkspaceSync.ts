/**
 * Workspace Sync Hook (SFTP + rsync)
 *
 * Provides workspace sync functionality for Tauri desktop app.
 * Features:
 * - SFTP connection lifecycle (connect/disconnect)
 * - File watcher for event-driven sync
 * - Workspace lock detection (shows when agent is working)
 * - Byte-level delta sync via rsync algorithm
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { isTauri } from './useDeviceFlow';

// ============================================================================
// Types
// ============================================================================

interface SyncConfig {
  folder_path: string;
  last_sync: number | null;
}

/** Sync result from SFTP operations */
interface SyncResult {
  files_synced: number;
  bytes_transferred: number;
  timestamp: number;
  direction: 'push' | 'pull' | 'queued' | 'none';
}

/** Workspace lock state (from .emery-lock file) */
interface WorkspaceLockState {
  locked: boolean;
  task_id: string | null;
  started_at: number | null;
  agent_id: number | null;
}

/** File change event from watcher */
interface FileChangeEvent {
  agent_id: number;
  paths: string[];
  timestamp: number;
}

export type SyncState = 'idle' | 'connecting' | 'syncing' | 'watching' | 'error';

export interface UseWorkspaceSyncReturn {
  // Availability
  isAvailable: boolean;

  // Connection state
  isConnected: boolean;
  isWatching: boolean;
  syncState: SyncState;

  // Paths
  syncPath: string | null;

  // Lock state (agent working)
  lockState: WorkspaceLockState | null;
  isLocked: boolean;

  // Sync info
  pendingChanges: number;
  lastSync: number | null;
  error: string | null;

  // Actions
  selectFolder: () => Promise<void>;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  pull: () => Promise<SyncResult | null>;
  push: () => Promise<SyncResult | null>;
  syncPending: () => Promise<SyncResult | null>;
}

// ============================================================================
// Tauri Invoke Helper
// ============================================================================

async function invokeTauri<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new Error('Tauri API not available');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}

// ============================================================================
// Hook
// ============================================================================

export function useWorkspaceSync(agentId: number, orgId: number): UseWorkspaceSyncReturn {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('idle');

  // Paths
  const [syncPath, setSyncPath] = useState<string | null>(null);

  // Lock state
  const [lockState, setLockState] = useState<WorkspaceLockState | null>(null);

  // Sync info
  const [pendingChanges, setPendingChanges] = useState(0);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs for cleanup
  const fileChangeUnlistenRef = useRef<(() => void) | null>(null);
  const lockPollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Track previous lock state for auto-pull on release
  const prevLockedRef = useRef<boolean>(false);

  // Track remote sync version for detecting web portal changes
  const lastSyncVersionRef = useRef<number>(0);

  const isAvailable = isTauri();

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const getApiBase = useCallback(() => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  }, []);

  const getApiKey = useCallback(async (): Promise<string> => {
    const apiKey = await invokeTauri<string | null>('get_api_key');
    if (!apiKey) {
      throw new Error('No API key configured. Please sign out and sign in again.');
    }
    return apiKey;
  }, []);

  // ---------------------------------------------------------------------------
  // Load saved config on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isAvailable) return;

    const loadConfig = async () => {
      try {
        const config = await invokeTauri<SyncConfig | null>('get_sync_config', {
          agentId,
        });
        if (config?.folder_path) {
          setSyncPath(config.folder_path);
          setLastSync(config.last_sync);
        }
      } catch (err) {
        console.error('Failed to load sync config:', err);
      }
    };

    loadConfig();
  }, [agentId, isAvailable]);

  // ---------------------------------------------------------------------------
  // SFTP Connection
  // ---------------------------------------------------------------------------

  const connect = useCallback(async (): Promise<boolean> => {
    if (!isAvailable || !syncPath) return false;

    try {
      setError(null);
      setSyncState('connecting');

      const apiKey = await getApiKey();
      const apiBase = getApiBase();

      await invokeTauri('sftp_connect', {
        agentId,
        orgId,
        apiKey,
        apiBase,
      });

      setIsConnected(true);
      setSyncState('idle');
      return true;
    } catch (err) {
      console.error('SFTP connection failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setSyncState('error');
      setIsConnected(false);
      return false;
    }
  }, [agentId, orgId, isAvailable, syncPath, getApiKey, getApiBase]);

  const disconnect = useCallback(async () => {
    if (!isAvailable) return;

    try {
      // Stop watching first
      if (isWatching) {
        await invokeTauri('stop_watching', { agentId });
        setIsWatching(false);
      }

      // Disconnect SFTP
      await invokeTauri('sftp_disconnect', { agentId });
      setIsConnected(false);
      setSyncState('idle');

      // Clear config
      await invokeTauri('set_sync_config', {
        agentId,
        folderPath: '',
      });
      setSyncPath(null);
      setLockState(null);
      setPendingChanges(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  }, [agentId, isAvailable, isWatching]);

  // ---------------------------------------------------------------------------
  // Auto-connect when syncPath is set
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isAvailable || !syncPath || isConnected) return;

    connect().catch(console.error);
  }, [isAvailable, syncPath, isConnected, connect]);

  // ---------------------------------------------------------------------------
  // File Watcher
  // ---------------------------------------------------------------------------

  const startWatching = useCallback(async () => {
    if (!isConnected || !syncPath) return;

    try {
      await invokeTauri('start_watching', {
        agentId,
        localPath: syncPath,
      });
      setIsWatching(true);
      setSyncState('watching');
    } catch (err) {
      console.error('Failed to start watching:', err);
    }
  }, [agentId, isConnected, syncPath]);

  // Start watching when connected
  useEffect(() => {
    if (!isConnected || !syncPath) return;

    startWatching();

    return () => {
      if (isWatching) {
        invokeTauri('stop_watching', { agentId }).catch(console.error);
      }
    };
  }, [agentId, isConnected, syncPath, startWatching, isWatching]);

  // ---------------------------------------------------------------------------
  // File Change Event Listener
  // ---------------------------------------------------------------------------

  const push = useCallback(async (): Promise<SyncResult | null> => {
    if (!isAvailable || !syncPath || !isConnected) return null;

    try {
      setError(null);
      setSyncState('syncing');

      const apiKey = await getApiKey();
      const apiBase = getApiBase();

      const result = await invokeTauri<SyncResult>('push_workspace', {
        agentId,
        localPath: syncPath,
        apiKey,
        apiBase,
      });

      setLastSync(result.timestamp);

      // If queued due to lock, update pending count
      if (result.direction === 'queued') {
        setPendingChanges((prev) => prev + 1);
      } else {
        setPendingChanges(0);
      }

      setSyncState(isWatching ? 'watching' : 'idle');
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to push');
      setSyncState('error');
      return null;
    }
  }, [agentId, isAvailable, isConnected, isWatching, syncPath, getApiKey, getApiBase]);

  // Listen for file change events and auto-push
  useEffect(() => {
    if (!isWatching) return;

    const setupListener = async () => {
      const { listen } = await import('@tauri-apps/api/event');

      const unlisten = await listen<FileChangeEvent>('workspace-file-change', (event) => {
        if (event.payload.agent_id === agentId) {
          console.log('File changed, syncing...', event.payload.paths);
          // Auto-push (will queue if locked)
          push().catch(console.error);
        }
      });

      fileChangeUnlistenRef.current = unlisten;
    };

    setupListener().catch(console.error);

    return () => {
      if (fileChangeUnlistenRef.current) {
        fileChangeUnlistenRef.current();
        fileChangeUnlistenRef.current = null;
      }
    };
  }, [agentId, isWatching, push]);

  // ---------------------------------------------------------------------------
  // Lock Status Polling + Remote Sync Version Check
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isConnected) return;

    const checkLockAndVersion = async () => {
      try {
        const apiKey = await getApiKey();
        const apiBase = getApiBase();

        // Check lock state via Tauri
        const state = await invokeTauri<WorkspaceLockState>('check_workspace_lock', {
          agentId,
        });
        setLockState(state);

        // Detect lock transition: true → false (agent finished working)
        const wasLocked = prevLockedRef.current;
        const isNowUnlocked = !state.locked;

        if (wasLocked && isNowUnlocked) {
          console.log('Lock released, auto-pulling agent changes...');
          try {
            await invokeTauri('pull_workspace', {
              agentId,
              localPath: syncPath,
              apiKey,
              apiBase,
            });
            setLastSync(Math.floor(Date.now() / 1000));
          } catch (pullErr) {
            console.error('Auto-pull failed:', pullErr);
          }

          // Then sync any pending local changes
          if (pendingChanges > 0) {
            console.log('Syncing pending local changes...');
            await invokeTauri('sync_pending_changes', { agentId, apiKey, apiBase });
            setPendingChanges(0);
          }
        }

        // Update previous lock state
        prevLockedRef.current = state.locked;

        // Check remote sync version (web portal changes) - only when not locked
        if (!state.locked) {
          try {
            const versionRes = await fetch(
              `${apiBase}/api/agents/${agentId}/workspace/file?path=/.emery-sync-version`,
              { headers: { 'Authorization': `Bearer ${apiKey}` } }
            );
            if (versionRes.ok) {
              const versionData = await versionRes.json();
              if (versionData.success && versionData.data?.content) {
                const remoteVersion = parseInt(versionData.data.content, 10);
                if (remoteVersion > lastSyncVersionRef.current) {
                  console.log('Remote sync version changed, auto-pulling web changes...');
                  lastSyncVersionRef.current = remoteVersion;
                  await invokeTauri('pull_workspace', {
                    agentId,
                    localPath: syncPath,
                    apiKey,
                    apiBase,
                  });
                  setLastSync(Math.floor(Date.now() / 1000));
                }
              }
            }
          } catch (versionErr) {
            // Version file may not exist yet - that's OK
          }
        }
      } catch (err) {
        console.error('Failed to check lock/version status:', err);
      }
    };

    // Check immediately
    checkLockAndVersion();

    // Poll every 5 seconds
    lockPollIntervalRef.current = setInterval(checkLockAndVersion, 5000);

    return () => {
      if (lockPollIntervalRef.current) {
        clearInterval(lockPollIntervalRef.current);
        lockPollIntervalRef.current = null;
      }
    };
  }, [agentId, isConnected, pendingChanges, syncPath, getApiKey, getApiBase]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

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
      // Connection will auto-start via useEffect
    } catch (err) {
      if (err instanceof Error && err.message.includes('cancelled')) {
        return; // User cancelled, not an error
      }
      setError(err instanceof Error ? err.message : 'Failed to select folder');
    }
  }, [agentId, isAvailable]);

  const pull = useCallback(async (): Promise<SyncResult | null> => {
    if (!isAvailable || !syncPath || !isConnected) return null;

    try {
      setError(null);
      setSyncState('syncing');

      const apiKey = await getApiKey();
      const apiBase = getApiBase();

      const result = await invokeTauri<SyncResult>('pull_workspace', {
        agentId,
        localPath: syncPath,
        apiKey,
        apiBase,
      });

      setLastSync(result.timestamp);
      setSyncState(isWatching ? 'watching' : 'idle');
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pull');
      setSyncState('error');
      return null;
    }
  }, [agentId, isAvailable, isConnected, isWatching, syncPath, getApiKey, getApiBase]);

  const syncPending = useCallback(async (): Promise<SyncResult | null> => {
    if (!isAvailable || !isConnected) return null;

    try {
      setError(null);
      setSyncState('syncing');

      const apiKey = await getApiKey();
      const apiBase = getApiBase();

      const result = await invokeTauri<SyncResult>('sync_pending_changes', {
        agentId,
        apiKey,
        apiBase,
      });

      if (result.direction !== 'none') {
        setLastSync(result.timestamp);
        setPendingChanges(0);
      }

      setSyncState(isWatching ? 'watching' : 'idle');
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync pending');
      setSyncState('error');
      return null;
    }
  }, [agentId, isAvailable, isConnected, isWatching, getApiKey, getApiBase]);

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      // Cleanup watcher
      if (fileChangeUnlistenRef.current) {
        fileChangeUnlistenRef.current();
      }
      // Cleanup lock polling
      if (lockPollIntervalRef.current) {
        clearInterval(lockPollIntervalRef.current);
      }
      // Disconnect SFTP
      if (isConnected) {
        invokeTauri('sftp_disconnect', { agentId }).catch(console.error);
      }
    };
  }, [agentId, isConnected]);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    // Availability
    isAvailable,

    // Connection state
    isConnected,
    isWatching,
    syncState,

    // Paths
    syncPath,

    // Lock state
    lockState,
    isLocked: lockState?.locked ?? false,

    // Sync info
    pendingChanges,
    lastSync,
    error,

    // Actions
    selectFolder,
    connect,
    disconnect,
    pull,
    push,
    syncPending,
  };
}
