'use client';

import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, FileQuestion, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TaskDetailPanel } from '../tasks/TaskDetailPanel';
import { WorkspaceFileViewer } from '../workspace/WorkspaceFileViewer';
import { WorkspacePdfViewer } from '../workspace/WorkspacePdfViewer';
import type { TaskDTO } from '@/app/mappers/task-mapper';
import type { ViewingFile } from '../types';

// AIDEV-NOTE: Right panel of split view
// Shows task detail with execution steps when a task is selected
// OR shows workspace file viewer when a file is selected

interface RightPanelProps {
  task: TaskDTO | null;
  agentId: number;
  viewingFile: ViewingFile | null;
  onFileSave: (path: string, content: string) => Promise<void>;
}

export function RightPanel({ task, agentId, viewingFile, onFileSave }: RightPanelProps) {
  // File viewer takes priority over task details
  if (viewingFile) {
    // Route to appropriate viewer based on file type
    switch (viewingFile.viewerType) {
      case 'pdf':
        return (
          <WorkspacePdfViewer
            filePath={viewingFile.path}
            url={viewingFile.url!}
          />
        );

      case 'image':
        return (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-border bg-muted/10">
              <div className="flex items-center gap-3">
                <ImageIcon className="w-5 h-5 text-primary" />
                <span className="font-medium text-sm">{viewingFile.path.split('/').pop()}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(viewingFile.url, '_blank')}
              >
                <Download className="w-3 h-3 mr-1" />
                Download
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-muted/5">
              <img
                src={viewingFile.url}
                alt={viewingFile.path.split('/').pop()}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>
        );

      case 'text':
        return (
          <WorkspaceFileViewer
            filePath={viewingFile.path}
            content={viewingFile.content || ''}
            mimeType={viewingFile.mimeType}
            onSave={(content) => onFileSave(viewingFile.path, content)}
          />
        );

      case 'unsupported':
      default:
        return (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-4">
              <FileQuestion className="w-12 h-12 mx-auto text-muted-foreground" />
              <div>
                <p className="font-medium">Preview not available</p>
                <p className="text-sm text-muted-foreground">
                  This file type cannot be previewed
                </p>
              </div>
              {viewingFile.url && (
                <Button
                  variant="outline"
                  onClick={() => window.open(viewingFile.url, '_blank')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download File
                </Button>
              )}
            </div>
          </div>
        );
    }
  }

  if (!task) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-sm">Select a task to view details</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <TaskDetailPanel task={task} agentId={agentId} />
    </ScrollArea>
  );
}
