'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { TaskDTO } from '@/app/mappers/task-mapper';

export interface LockState {
  locked: boolean;
}

export interface WorkspaceVersion {
  version: string;
}

export type AgentStreamEventType =
  | 'tasks_snapshot'
  | 'tasks_updated'
  | 'lock_changed'
  | 'workspace_updated';

export interface AgentStreamEvent {
  type: AgentStreamEventType;
  timestamp: string;
  data: TaskDTO[] | LockState | WorkspaceVersion;
}

interface UseAgentStreamOptions {
  enabled?: boolean;
  onTasksUpdate?: (tasks: TaskDTO[]) => void;
  onLockChange?: (locked: boolean) => void;
  onWorkspaceUpdate?: (version: string) => void;
}

interface UseAgentStreamResult {
  tasks: TaskDTO[];
  lockState: LockState | null;
  workspaceVersion: string | null;
  isConnected: boolean;
  error: Error | null;
  reconnect: () => void;
}

/**
 * Hook to subscribe to real-time agent updates via SSE
 *
 * Replaces polling with a single persistent connection that streams:
 * - Task list updates (new tasks, status changes)
 * - Workspace lock state (agent working)
 * - Workspace version changes (remote updates)
 */
export function useAgentStream(
  agentId: number | null,
  options: UseAgentStreamOptions = {}
): UseAgentStreamResult {
  const { enabled = true, onTasksUpdate, onLockChange, onWorkspaceUpdate } = options;

  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [lockState, setLockState] = useState<LockState | null>(null);
  const [workspaceVersion, setWorkspaceVersion] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!agentId || !enabled) return;

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const url = `/api/agents/${agentId}/stream`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      console.log(`[AgentStream] Connected to agent ${agentId}`);
    };

    eventSource.onmessage = (event) => {
      try {
        const parsed: AgentStreamEvent = JSON.parse(event.data);

        switch (parsed.type) {
          case 'tasks_snapshot':
          case 'tasks_updated': {
            const taskData = parsed.data as TaskDTO[];
            setTasks(taskData);
            onTasksUpdate?.(taskData);
            break;
          }
          case 'lock_changed': {
            const lockData = parsed.data as LockState;
            setLockState(lockData);
            onLockChange?.(lockData.locked);
            break;
          }
          case 'workspace_updated': {
            const versionData = parsed.data as WorkspaceVersion;
            setWorkspaceVersion(versionData.version);
            onWorkspaceUpdate?.(versionData.version);
            break;
          }
        }
      } catch (e) {
        console.error('[AgentStream] Failed to parse event:', e);
      }
    };

    eventSource.onerror = (e) => {
      console.error('[AgentStream] Connection error:', e);
      setIsConnected(false);
      setError(new Error('Connection lost'));

      // Auto-reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('[AgentStream] Attempting to reconnect...');
        connect();
      }, 5000);
    };
  }, [agentId, enabled, onTasksUpdate, onLockChange, onWorkspaceUpdate]);

  const reconnect = useCallback(() => {
    connect();
  }, [connect]);

  // Connect on mount / agentId change
  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return {
    tasks,
    lockState,
    workspaceVersion,
    isConnected,
    error,
    reconnect,
  };
}
