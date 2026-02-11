'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { LeftPanel } from './panels/LeftPanel';
import { RightPanel } from './panels/RightPanel';
import { useAgentStream } from '@/hooks/useAgentStream';
import type { TaskDTO } from '@/app/mappers/task-mapper';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import type { ViewingFile, FileViewerType } from './types';

// AIDEV-NOTE: Main split view layout for agent detail page
// Left panel: Tasks list + collapsible Workspace & Automations sections
// Right panel: Task detail with execution steps OR workspace file viewer

// Helper to detect viewer type from file extension
function getViewerType(path: string): FileViewerType {
  const ext = path.split('.').pop()?.toLowerCase() || '';

  // PDF files
  if (ext === 'pdf') return 'pdf';

  // Image files
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext)) return 'image';

  // Text/code files
  if ([
    'txt', 'md', 'mdx', 'markdown',
    'js', 'jsx', 'ts', 'tsx', 'json',
    'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'hpp',
    'html', 'css', 'scss', 'less',
    'yaml', 'yml', 'toml', 'ini', 'cfg',
    'sql', 'sh', 'bash', 'zsh',
    'xml', 'csv', 'log', 'env'
  ].includes(ext)) return 'text';

  return 'unsupported';
}

interface AgentSplitViewProps {
  agent: AgentDTO;
  tasks: TaskDTO[];
}

export function AgentSplitView({ agent, tasks: initialTasks }: AgentSplitViewProps) {
  const agentId = agent.id;
  const automations = agent.automations;
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    initialTasks.length > 0 ? initialTasks[0].id : null
  );
  const [viewingFile, setViewingFile] = useState<ViewingFile | null>(null);

  // Subscribe to real-time agent updates via SSE
  const { tasks: streamedTasks, lockState, isConnected } = useAgentStream(agentId);

  // Use streamed tasks if available, otherwise fall back to initial props
  // SSE sends tasks as raw DB rows, so we cast them
  const tasks = (streamedTasks.length > 0 ? streamedTasks : initialTasks) as TaskDTO[];

  // Validate selectedTaskId when tasks list changes
  // If the selected task is no longer in the list, select the first available task
  useEffect(() => {
    if (selectedTaskId) {
      const taskExists = tasks.some(t => t.id === selectedTaskId);
      if (!taskExists) {
        // Selected task was deleted or no longer available, select first task
        setSelectedTaskId(tasks.length > 0 ? tasks[0].id : null);
      }
    } else if (tasks.length > 0 && !selectedTaskId) {
      // No task selected but tasks exist, select the first one
      setSelectedTaskId(tasks[0].id);
    }
  }, [tasks, selectedTaskId]);

  const selectedTask = tasks.find(t => t.id === selectedTaskId) || null;

  // Log connection status for debugging
  useEffect(() => {
    if (isConnected) {
      console.log(`[AgentSplitView] SSE connected for agent ${agentId}`);
    }
  }, [isConnected, agentId]);

  // Log lock state changes
  useEffect(() => {
    if (lockState) {
      console.log(`[AgentSplitView] Lock state: ${lockState.locked ? 'LOCKED' : 'unlocked'}`);
    }
  }, [lockState]);

  // Handle file selection from workspace tree
  const handleFileSelect = useCallback(async (path: string) => {
    try {
      const viewerType = getViewerType(path);
      const response = await fetch(`/api/agents/${agentId}/workspace/file?path=${encodeURIComponent(path)}`);
      const result = await response.json();

      if (result.success) {
        // Binary files return url, text files return content
        if (result.data.isBinary) {
          setViewingFile({
            path,
            url: result.data.url,
            mimeType: result.data.mimeType,
            viewerType
          });
        } else {
          setViewingFile({
            path,
            content: result.data.content,
            mimeType: result.data.mimeType || 'text/plain',
            viewerType
          });
        }
      } else {
        console.error('Failed to load file:', result.error);
      }
    } catch (error) {
      console.error('Error loading file:', error);
    }
  }, [agentId]);

  // Handle saving file to workspace (EFS)
  const handleFileSave = useCallback(async (path: string, content: string) => {
    const response = await fetch(
      `/api/agents/${agentId}/workspace/file?path=${encodeURIComponent(path)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      }
    );
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to save file');
    }
    // Update local state with saved content
    setViewingFile(prev => prev ? { ...prev, content } : null);
  }, [agentId]);

  // When selecting a task, close the file viewer
  const handleSelectTask = useCallback((taskId: string | null) => {
    setSelectedTaskId(taskId);
    setViewingFile(null); // Close file viewer when selecting a task
  }, []);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Panel - Tasks + collapsible sections */}
      <div className="w-96 min-w-96 border-r border-border flex flex-col overflow-hidden">
        <LeftPanel
          agent={agent}
          tasks={tasks}
          automations={automations}
          selectedTaskId={selectedTaskId}
          onSelectTask={handleSelectTask}
          onFileSelect={handleFileSelect}
          selectedFilePath={viewingFile?.path}
        />
      </div>

      {/* Right Panel - Task detail OR file viewer */}
      <div className="flex-1 overflow-hidden">
        <RightPanel
          task={selectedTask}
          agentId={agentId}
          viewingFile={viewingFile}
          onFileSave={handleFileSave}
        />
      </div>
    </div>
  );
}
