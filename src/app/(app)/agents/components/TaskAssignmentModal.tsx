'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, CheckCircle2 } from 'lucide-react';
import type { AgentDTO } from '@/app/mappers/agent-mapper';
import type { ToolConfigDTO } from '@/app/mappers/skill-mapper';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';
import { createTask } from '@/app/actions/tasks';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { UnifiedChatInput } from '@/components/shared/UnifiedChatInput';

interface TaskAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: AgentDTO;
  onSuccess?: () => void;
}

export function TaskAssignmentModal({ isOpen, onClose, agent, onSuccess }: TaskAssignmentModalProps) {
  const [taskName, setTaskName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [tools, setTools] = useState<ToolConfigDTO[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTaskName('');
      setInstructions('');
      setTools([]);
      setSaveStatus('idle');
      setErrorMessage('');
    }
  }, [isOpen]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveStatus('saving');
      setErrorMessage('');

      // Validation
      const validationErrors: string[] = [];

      if (!taskName?.trim()) {
        validationErrors.push('Task name is required');
      }

      if (!instructions?.trim()) {
        validationErrors.push('Task instructions are required');
      }

      if (validationErrors.length > 0) {
        const errorMsg = validationErrors.join(', ');
        throw new Error(`Validation failed: ${errorMsg}`);
      }

      // Convert ToolConfigDTO[] to ToolConfig[] for domain layer
      const domainTools = tools.length > 0
        ? tools.map(t => ToolConfig.create(t.name, t.config || {}))
        : undefined;

      // Create task
      const result = await createTask({
        agentId: agent.id,
        name: taskName.trim(),
        instructions: {
          task: instructions.trim(),
          tools: domainTools,
          metadata: {}
        }
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to create task');
      }

      // Show success state briefly before closing
      setSaveStatus('success');

      setTimeout(() => {
        onSuccess?.();
        onClose();
        // Reset states
        setSaveStatus('idle');
        setErrorMessage('');
      }, 800);
    } catch (error) {
      console.error('Error creating task:', error);
      setSaveStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create task');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-lg shadow-xl w-full max-w-2xl border max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-xl font-semibold">Assign Task</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Create a new task for {agent.name}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-2 hover:bg-accent rounded-md transition-colors disabled:opacity-50"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {/* Task Name */}
          <div className="space-y-2">
            <Label htmlFor="task-name" className="text-base font-medium">
              Task Name *
            </Label>
            <Input
              id="task-name"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="e.g., Generate weekly sales report, Analyze customer data"
              className="text-base"
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground">
              Give this task a clear, descriptive name
            </p>
          </div>

          {/* Task Instructions with @ Tool Mentions */}
          <div className="space-y-2">
            <UnifiedChatInput
              value={instructions}
              onChange={setInstructions}
              tools={tools}
              onToolsChange={setTools}
              label="Task Instructions *"
              helpText="Define what should be done. Use @ to reference tools, documents, files, agents, or tables."
              placeholder="Describe the task to execute... (Type @ to add tools)"
              id="task-instructions"
              mode="form"
              minHeight="200px"
              enableSendButton={false}
              enableAttachments={false}
            />
          </div>

          {/* Status Feedback */}
          {saveStatus === 'success' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-900">Task Created Successfully!</h4>
                  <p className="text-sm text-green-700 mt-1">
                    The task has been assigned to {agent.name} and is ready to execute.
                  </p>
                </div>
              </div>
            </div>
          )}

          {saveStatus === 'error' && errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <X className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-900">Error Creating Task</h4>
                  <p className="text-sm text-red-700 mt-1">
                    {errorMessage}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Assign Task
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
