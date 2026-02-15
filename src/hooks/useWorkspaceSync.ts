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

// Rate limiting constant - minimum time between syncs in ms
const MIN_SYNC_INTERVAL_MS = 1000;

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

/** SSE lock changed event from Tauri */
interface AgentLockChangedEvent {
  agent_id: number;
  locked: boolean;
}

/** SSE workspace updated event from Tauri */
interface AgentWorkspaceUpdatedEvent {
  agent_id: number;
  version: string;
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
  const sseUnlistenLockRef = useRef<(() => void) | null>(null);
  const sseUnlistenWorkspaceRef = useRef<(() => void) | null>(null);

  // Track previous lock state for auto-pull on release
  const prevLockedRef = useRef<boolean>(false);

  // Track remote sync version for detecting web portal changes
  const lastSyncVersionRef = useRef<number>(0);

  // Rate limiting: track last push time to prevent rapid successive syncs
  const lastPushTimeRef = useRef<number>(0);
  const pendingPushRef = useRef<NodeJS.Timeout | null>(null);

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

  const getApiKey = useCallback(async (forceRefresh = false): Promise<string> => {
    let apiKey = forceRefresh ? null : await invokeTauri<string | null>('get_api_key');

    // If no API key stored (or force refresh), fetch from session
    if (!apiKey) {
      console.log('[WorkspaceSync] Fetching fresh API key from session...');
      try {
        const res = await fetch('/api/user/refresh-api-key', {
          method: 'POST',
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (data.apiKey) {
            apiKey = data.apiKey;
            await invokeTauri('store_api_key', { apiKey });
            console.log('[WorkspaceSync] API key fetched and stored');
          }
        }
      } catch (err) {
        console.error('[WorkspaceSync] Failed to fetch API key:', err);
      }
    }

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

  // Internal push function without rate limiting
  const pushInternal = useCallback(async (): Promise<SyncResult | null> => {
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
      lastPushTimeRef.current = Date.now();

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

  // Rate-limited push function
  const push = useCallback(async (): Promise<SyncResult | null> => {
    if (!isAvailable || !syncPath || !isConnected) return null;

    const now = Date.now();
    const timeSinceLastPush = now - lastPushTimeRef.current;

    // If enough time has passed, push immediately
    if (timeSinceLastPush >= MIN_SYNC_INTERVAL_MS) {
      // Clear any pending scheduled push
      if (pendingPushRef.current) {
        clearTimeout(pendingPushRef.current);
        pendingPushRef.current = null;
      }
      return pushInternal();
    }

    // Otherwise, schedule a push for later (debounce)
    // If there's already a pending push scheduled, don't schedule another
    if (!pendingPushRef.current) {
      const delay = MIN_SYNC_INTERVAL_MS - timeSinceLastPush;
      pendingPushRef.current = setTimeout(() => {
        pendingPushRef.current = null;
        pushInternal().catch(console.error);
      }, delay);
    }

    // Return null since the actual push is deferred
    return null;
  }, [isAvailable, isConnected, syncPath, pushInternal]);

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
  // SSE Subscription for Real-Time Lock & Workspace Updates
  // ---------------------------------------------------------------------------

  // Handle lock change (from SSE via Tauri event)
  const handleLockChange = useCallback(async (locked: boolean) => {
    const wasLocked = prevLockedRef.current;
    prevLockedRef.current = locked;

    setLockState((prev) => ({ ...(prev || { task_id: null, started_at: null, agent_id: null }), locked }));

    // Detect lock transition: true → false (agent finished working)
    if (wasLocked && !locked) {
      console.log('[WorkspaceSync] Lock released, auto-pulling agent changes...');
      try {
        const apiKey = await getApiKey();
        const apiBase = getApiBase();

        await invokeTauri('pull_workspace', {
          agentId,
          localPath: syncPath,
          apiKey,
          apiBase,
        });
        setLastSync(Math.floor(Date.now() / 1000));

        // Then sync any pending local changes
        if (pendingChanges > 0) {
          console.log('[WorkspaceSync] Syncing pending local changes...');
          await invokeTauri('sync_pending_changes', { agentId, apiKey, apiBase });
          setPendingChanges(0);
        }
      } catch (pullErr) {
        console.error('[WorkspaceSync] Auto-pull failed:', pullErr);
      }
    }
  }, [agentId, syncPath, pendingChanges, getApiKey, getApiBase]);

  // Handle workspace version change (from SSE via Tauri event)
  const handleWorkspaceUpdate = useCallback(async (version: string) => {
    const newVersion = parseInt(version, 10);
    if (isNaN(newVersion) || newVersion <= lastSyncVersionRef.current) {
      return; // Not a new version
    }

    console.log('[WorkspaceSync] Remote workspace updated, auto-pulling...');
    lastSyncVersionRef.current = newVersion;

    try {
      const apiKey = await getApiKey();
      const apiBase = getApiBase();

      await invokeTauri('pull_workspace', {
        agentId,
        localPath: syncPath,
        apiKey,
        apiBase,
      });
      setLastSync(Math.floor(Date.now() / 1000));
    } catch (pullErr) {
      console.error('[WorkspaceSync] Auto-pull on workspace update failed:', pullErr);
    }
  }, [agentId, syncPath, getApiKey, getApiBase]);

  useEffect(() => {
    if (!isConnected) return;

    let mounted = true;

    const setupSse = async () => {
      try {
        // Always fetch fresh key for SSE since it's a long-lived connection
        // and the stored key may have been rotated by other code
        const apiKey = await getApiKey(true);
        const apiBase = getApiBase();
        const { listen } = await import('@tauri-apps/api/event');

        // Start SSE subscription via Tauri
        await invokeTauri('start_agent_sse', {
          agentId,
          apiKey,
          apiBase,
        });
        console.log('[WorkspaceSync] SSE subscription started for agent', agentId);

        // Listen for lock change events from Tauri
        const unlistenLock = await listen<AgentLockChangedEvent>('agent-lock-changed', (event) => {
          if (event.payload.agent_id === agentId && mounted) {
            console.log('[WorkspaceSync] Lock changed:', event.payload.locked);
            handleLockChange(event.payload.locked);
          }
        });
        sseUnlistenLockRef.current = unlistenLock;

        // Listen for workspace update events from Tauri
        const unlistenWorkspace = await listen<AgentWorkspaceUpdatedEvent>('agent-workspace-updated', (event) => {
          if (event.payload.agent_id === agentId && mounted) {
            console.log('[WorkspaceSync] Workspace updated:', event.payload.version);
            handleWorkspaceUpdate(event.payload.version);
          }
        });
        sseUnlistenWorkspaceRef.current = unlistenWorkspace;

        // Fetch initial lock state (one-time, not polling)
        const state = await invokeTauri<WorkspaceLockState>('check_workspace_lock', {
          agentId,
          apiKey,
          apiBase,
        });
        if (mounted) {
          setLockState(state);
          prevLockedRef.current = state.locked;
        }
      } catch (err) {
        console.error('[WorkspaceSync] Failed to setup SSE:', err);
      }
    };

    setupSse();

    return () => {
      mounted = false;

      // Stop SSE subscription
      invokeTauri('stop_agent_sse', { agentId }).catch(console.error);

      // Cleanup event listeners
      if (sseUnlistenLockRef.current) {
        sseUnlistenLockRef.current();
        sseUnlistenLockRef.current = null;
      }
      if (sseUnlistenWorkspaceRef.current) {
        sseUnlistenWorkspaceRef.current();
        sseUnlistenWorkspaceRef.current = null;
      }
    };
  }, [agentId, isConnected, getApiBase, getApiKey, handleLockChange, handleWorkspaceUpdate]);

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
      // Cleanup lock polling (legacy fallback)
      if (lockPollIntervalRef.current) {
        clearInterval(lockPollIntervalRef.current);
      }
      // Cleanup SSE event listeners
      if (sseUnlistenLockRef.current) {
        sseUnlistenLockRef.current();
      }
      if (sseUnlistenWorkspaceRef.current) {
        sseUnlistenWorkspaceRef.current();
      }
      // Stop SSE subscription
      invokeTauri('stop_agent_sse', { agentId }).catch(() => {});
      // Cleanup pending push timeout
      if (pendingPushRef.current) {
        clearTimeout(pendingPushRef.current);
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
