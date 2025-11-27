'use client';

/**
 * TaskInstructionsDialog - Dialog for configuring task instructions with UnifiedChatInput
 *
 * Isolates UnifiedChatInput from Puck's re-render cycle by using a dialog pattern.
 * Based on TaskAssignmentModal + ScheduleDialog patterns.
 */

import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { UnifiedChatInput } from '@/components/shared/UnifiedChatInput';
import type { TaskInstructions } from '@/ddd/domain/tasks/entities/task';
import type { ToolConfigDTO } from '@/app/mappers/skill-mapper';
import { ToolConfig } from '@/ddd/domain/tools/value-objects/tool-config';

interface TaskInstructionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  value: TaskInstructions;
  onSave: (value: TaskInstructions) => void;
  agentName?: string;
}

export function TaskInstructionsDialog({
  isOpen,
  onClose,
  value,
  onSave,
  agentName,
}: TaskInstructionsDialogProps) {
  const [instructions, setInstructions] = useState(value?.task || '');
  const [tools, setTools] = useState<ToolConfigDTO[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);

  // Reset form when dialog opens with new value
  useEffect(() => {
    if (isOpen) {
      setInstructions(value?.task || '');
      setPendingAttachments([]);
      // Convert ToolConfig[] to ToolConfigDTO[] if present
      if (value?.tools && Array.isArray(value.tools)) {
        setTools(
          value.tools.map((t) => ({
            name: t.name,
            config: t.config || {},
          }))
        );
      } else {
        setTools([]);
      }
    }
  }, [isOpen, value]);

  // Attachment handlers
  const handleAttachmentAdd = (file: File) => {
    setPendingAttachments((prev) => [...prev, file]);
  };

  const handleAttachmentRemove = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    // Convert ToolConfigDTO[] to ToolConfig[] for domain layer
    const domainTools =
      tools.length > 0
        ? tools.map((t) => ToolConfig.create(t.name, t.config || {}))
        : undefined;

    onSave({
      task: instructions.trim(),
      tools: domainTools,
      metadata: value?.metadata || {},
    });
    onClose();
  };

  const canSave = instructions.trim().length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {agentName ? `Configure Task for ${agentName}` : 'Configure Task Instructions'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Task Instructions</Label>
            <UnifiedChatInput
              value={instructions}
              onChange={setInstructions}
              tools={tools}
              onToolsChange={setTools}
              placeholder="Describe the task to execute... (Type @ to add tools)"
              id="task-instructions-dialog"
              mode="form"
              minHeight="150px"
              enableSendButton={false}
              enableAttachments={true}
              pendingAttachments={pendingAttachments}
              onAttachmentAdd={handleAttachmentAdd}
              onAttachmentRemove={handleAttachmentRemove}
            />
            <p className="text-xs text-muted-foreground">
              Define what should be done. Use @ to reference tools, documents, files, agents, or
              tables. Use {"${rowData.fieldName}"} to include data from the current row.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
